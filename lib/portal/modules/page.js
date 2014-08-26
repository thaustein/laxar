/**
 * Copyright 2014 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
define( [
   'angular',
   'jquery',
   '../../utilities/storage',
   '../../utilities/object',
   '../../logging/log',
   '../../directives/layout/layout',
   '../portal_assembler/page_loader',
   '../portal_assembler/widget_loader',
   '../paths',
   '../timer'
], function( ng, $, storage, object, log, layoutModule, pageLoader, widgetLoaderModule, paths, timer ) {
   'use strict';

   var module = ng.module( 'laxar.portal.page', [ layoutModule.name ] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    * Mediates between the FlowController which has no ties to the DOM and the stateful PageController
    */
   module.service( 'axPageService', [ function() {

      var pageController;

      return {
         controller: function() {
            return pageController;
         },
         registerPageController: function( controller ) {
            pageController = controller;
            return function() {
               pageController = null;
            };
         },
         controllerForScope: function( scope ) {
            return pageController;
         }
      };

   } ] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    * Directives should use this service to stay informed about visibility changes to their widget.
    * They should not attempt to determine their visibility from the EventBus (no DOM information), or
    * to poll it from the browser (too expensive).
    *
    * In contrast to the visibility events received over the event bus, these handlers will fire _after_ the
    * visibility change has been implemented in the DOM, at which point in time the actual browser rendering
    * state should correspond to the information conveyed in the event.
    *
    * The visibility service allows to register for onShow/onHide/onChange. When cleared, all handlers for
    * the given scope will be cleared. Handlers are automatically be cleared as soon as the given scope is
    * destroyed. Handlers will be invoked whenever the given scope's visibility changes due to the widget
    * becoming visible/invisible. It does _not_ fire on state changes originating _from within_ the widget
    * such as those caused by `ngShow`.
    *
    * If a widget becomes visible at all, the corresponding handlers for onChange and onShow are guaranteed
    * to be called at least once.
    */
   module.factory( 'axVisibilityService', [ 'axPageService', function( axPageService, $rootScope ) {

      /**
       * Create a visibility service handler for the given scope.
       * @param scope
       * @returns {{onChange: Function, clear: Function, onShow: Function, onHide: Function}}
       */
      function handlerFor( scope ) {

         var id = scope.id;
         scope.$on( '$destroy', clear );

         var widgetScope = scope;
         // Find the widget scope:
         while( widgetScope !== $rootScope && !(widgetScope.widget && widgetScope.widget.area) ) {
            widgetScope = widgetScope.$parent;
         }

         var area = widgetScope.widget.area;
         if( !area ) {
            throw new Error( 'axVisibilityService: could not determine widget area for scope: ' + id );
         }

         function clear() {
            clearDomHandlers( id );
         }

         return {
            onChange: function( handler ) {
               addHandler( id, area, handler, true );
               addHandler( id, area, handler, false );
            },
            clear: clear,
            onShow: function( handler ) {
               addHandler( id, area, handler, true );
            },
            onHide: function( handler ) {
               addHandler( id, area, handler, false );
            }
         };

      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      // store the registered show/hide-handlers by governing widget area
      var showHandlers = {};
      var hideHandlers = {};

      // secondary lookup-table to track removal, avoiding O(n^2) cost for deleting n handlers in a row
      var handlersById = {};

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function handlersForAreaAndState( area, targetState ) {
         var areaHandlers = ( targetState ? showHandlers : hideHandlers )[ area ];
         if( !areaHandlers ) { return null; }
         for( var i = areaHandlers.length - 1; i >= 0; ++i ) {
            var handlerRef = areaHandlers[ i ];
            if( handlerRef.handler === null ) {
               areaHandlers.splice( i, 1 );
            }
         }
         return areaHandlers;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function addHandler( id, area, handler, targetState ) {
         var handlerRef = { handler: handler };
         handlersById[ id ] = handlersById[ id ] || [];
         handlersById[ id ].push( handlerRef );

         var areaHandlers = targetState ? showHandlers : hideHandlers;
         areaHandlers[ area ] = areaHandlers[ area ] || [];
         areaHandlers[ area ].push( handlerRef );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function clearDomHandlers( id ) {
         handlersById[ id ].forEach( function( matchingHandlerRef ) {
            matchingHandlerRef.handler = null;
         } );
      }

      return {
         handlerForScope: handlerFor,
         // internal api for use by the page controller
         _handlersForAreaAndState: handlersForAreaAndState
      };

   } ] );


   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    * Manages widget adapters and their DOM for the current page
    */
   module.controller( 'axPageController', [
      '$scope', 'axPageService', '$q', 'Configuration', 'LayoutLoader', 'EventBus', 'FileResourceProvider', 'ThemeManager', '$timeout',
      function( $scope, pageService, $q, configuration, layoutLoader, eventBus, fileResourceProvider, themeManager, $timeout ) {

         var self = this;
         var pageLoader_ = pageLoader.create( $q, null, paths.PAGES, fileResourceProvider );

         var areaHelper_;
         var widgetAdapters_ = [];

         var theme = themeManager.getTheme();
         var localeManager = createLocaleManager();
         var visibilityManager = createVisibilityManager();
         var lifecycleEvent = { lifecycleId: 'default' };
         var eventOptions = { sender: 'PageService' };

         var renderLayout = function() {
            assert.codeIsUnreachable( 'No layout renderer!' );
         };

         var cleanup = pageService.registerPageController( this );
         $scope.$on( '$destroy', cleanup );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function widgetsForPage( page ) {
            var widgets = [];
            object.forEach( page.areas, function( area, areaName ) {
               area.forEach( function( widget ) {
                  widget.area = areaName;
                  widgets.push( widget );
               } );
            } );
            return widgets;
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function beginLifecycle() {
            return eventBus.publishAndGatherReplies(
               'beginLifecycleRequest.default',
               lifecycleEvent,
               eventOptions );
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function publishTheme() {
            return eventBus.publish( 'didChangeTheme.' + theme, { theme: theme }, eventOptions );
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         /**
          * Instantiate all widget controllers on this page, and then load their UI.
          *
          * @return {Promise}
          *    A promise that is resolved when all controllers have been instantiated, and when the initial
          *    events have been sent.
          */
         function setupPage( pageName ) {
            var widgetLoader_ = widgetLoaderModule.create( $q, fileResourceProvider, eventBus, {
               theme: themeManager.getTheme(),
               anchorScope: $scope
            } );

            localeManager.subscribe();
            var layoutDeferred = $q.defer();
            var pagePromise = pageLoader_.loadPage( pageName )
               .then( function( page ) {
                  areaHelper_ = createAreaHelper( $q, page );
                  self.areas = areaHelper_;
                  layoutLoader.load( page.layout ).then( layoutDeferred.resolve );

                  // instantiate controllers
                  var widgets = widgetsForPage( page );
                  return $q.all( widgets.map( function( widget ) {
                     return widgetLoader_.load( widget );
                  } ) );
               } )
               .then( function( widgetAdapters ) {
                  widgetAdapters_ = widgetAdapters;
               } )
               .then( localeManager.initialize )
               .then( publishTheme )
               .then( beginLifecycle )
               .then( visibilityManager.initialize );

            var layoutReady = layoutDeferred.promise.then( function( result ) {
               renderLayout( result );
            } );

            // Give the widgets some time to settle before $digesting and painting everything:
            var widgetsInitialized = pagePromise.then( function() {
               return $timeout( function(){}, 50, false );
            } );

            $q.all( [ layoutReady, widgetsInitialized ] )
               .then( function() {
                  return areaHelper_.prepareWidgets( widgetAdapters_ );
               } )
               .then( function assembleDom() {
                  areaHelper_.attachWidgets( widgetAdapters_ );
               } );

            return pagePromise;
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function tearDownPage() {
            localeManager.unsubscribe();

            return eventBus
               .publishAndGatherReplies(
                  'endLifecycleRequest.default',
                  lifecycleEvent,
                  eventOptions
               ).then( function() {
                  widgetAdapters_.forEach( function( adapter ) {
                     adapter.destroy();
                  } );
                  widgetAdapters_ = [];
               } );
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function registerLayoutRenderer( render ) {
            renderLayout = render;
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         /**
          * The LocaleManager initializes the locale(s) and implements changes to them.
          *
          * Before publishing the state of all configured locales, it listens to change requests, allowing
          * widgets and activities (such as a LocaleSwitcherWidget) to influence the state of locales before
          * the navigation is complete.
          */
         function createLocaleManager() {
            // DEPRECATION: the key 'locales' has been deprecated in favor of 'i18n.locales'
            var configLocales_ = configuration.get( 'i18n.locales', configuration.get( 'locales', {} ) );
            var i18n;
            var initialized;

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function handleRequest( event ) {
               i18n[ event.locale ] = event.languageTag;
               if( initialized ) {
                  publish( event.locale );
               }
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function publish( locale ) {
               var event = { locale: locale, languageTag: i18n[ locale ] };
               return eventBus.publish( 'didChangeLocale.' + locale, event, eventOptions );
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function initialize() {
               initialized = true;
               return $q.all( Object.keys( configLocales_ ).map( publish ) );
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function unsubscribe() {
               eventBus.unsubscribe( handleRequest );
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function subscribe() {
               i18n = object.deepClone( configLocales_ );
               initialized = false;

               eventBus.subscribe( 'changeLocaleRequest', handleRequest, eventOptions );
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            return {
               initialize: initialize,
               subscribe: subscribe,
               unsubscribe: unsubscribe
            };
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         /**
          * The AreaVisibilityManager initializes and coordinates widget area visibility.
          * It subscribes to all visibility changes and propagates them to nested widget areas
          * (if applicable). It is not concerned with DOM-visibility of individual controls: the
          * `axVisibilityService` takes care of that.
          *
          * @return {{initialize: Function}}
          *    a function to trigger initialization of the manager and initial widget visibility
          */
         function createVisibilityManager() {

            var ROOT = '';
            var subscriberOptions = { subscriber: 'VisibilityManager' };
            var eventOptions = { sender: 'VisibilityManager', deliverToSender: false };

            function initialize() {
               // broadcast visibility changes in individual widgets to their nested areas
               eventBus.subscribe( 'changeWidgetVisibilityRequest', function( event ) {
                  var affectedAreas = areaHelper_.areasInWidget( event.widget );
                  var will = [ 'willChangeWidgetVisibility', event.widget, event.visible ].join( '.' );
                  var did = [ 'didChangeWidgetVisibility', event.widget, event.visible ].join( '.' );
                  eventBus.publish( will, event, eventOptions );
                  $q.all( ( affectedAreas || [] ).map( event.visible ? show : hide ) ).then( function() {
                     eventBus.publish( did, event, eventOptions );
                  } );
               }, subscriberOptions );

               // broadcast visibility changes in widget areas to their nested areas
               eventBus.subscribe( 'changeAreaVisibilityRequest', function( event ) {
                  return initiateAreaChange( event.area, event.visible );
               }, subscriberOptions );

               implementAreaChange( ROOT, true );
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function show( area ) {
               return requestAreaChange( area, true );
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function hide( area ) {
               return requestAreaChange( area, false );
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * First, publish a `changeAreaVisibilityRequest` to ask if some widget would like to manage the
             * given area's visibility.
             * If no widget responds, self-issue a will/did-response to notify interested widgets in the area
             * of their new visibility status.
             * In either case, manage the propagation to nested areas and inform the area helper so that it
             * may compile and attach the templates of any newly visible widgets.
             *
             * @param {String} area
             *    the area whose visibility to update
             * @param {Boolean} visible
             *    the new visibility state of the given area, to the best knowledge of the client
             */
            function requestAreaChange( area, visible ) {
               var request = [ 'changeAreaVisibilityRequest', area ].join( '.' );
               var event = { area: area, visible: visible };
               return eventBus.publishAndGatherReplies( request, event, eventOptions ).then( function( responses ) {
                  if( responses.length === 0 ) {
                     // no one took responsibility, so the portal determines visibility by area nesting
                     return initiateAreaChange( area, visible );
                  }
                  // assume the first 'did'-response to be authoritative:
                  var response = responses[ 0 ];
                  return implementAreaChange( area, response.event.visible );
               } );
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            /**
             * Set the new visibility state for the given area, then issue requests for the child areas.
             * Inform the area helper so that it may compile and attach the templates of any newly visible
             * widgets.
             */
            function initiateAreaChange( area, visible ) {
               var will = [ 'willChangeAreaVisibility', area, visible ].join( '.' );
               var event = { area: area, visible: visible };
               eventBus.publish( will, event, eventOptions )
                  .then( function() {
                     return implementAreaChange( area, visible );
                  } )
                  .then( function() {
                     var did = [ 'didChangeAreaVisibility', area, visible ].join( '.' );
                     return eventBus.publish( did, event, eventOptions );
                  } );
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function implementAreaChange( ofArea, areaVisible ) {
               areaHelper_.setVisibility( ofArea, areaVisible );
               var children = areaHelper_.areasInArea( ofArea );
               if( !children ) { return $q.when(); }
               return $q.all( children.map( areaVisible ? show : hide ) );
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            return {
               initialize: initialize,
               visibilityManager: visibilityManager
            };
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         this.setupPage = setupPage;
         this.tearDownPage = tearDownPage;
         this.registerLayoutRenderer = registerLayoutRenderer;
      }
   ] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    * The AreaHelper manages widget areas and their nesting structure.
    * It also keeps track of which widget lives in which area.
    * It tracks widget area visibility to compile widgets and to attach them to their areas when the areas
    * become visible.
    */
   function createAreaHelper( q, page, visibilityService ) {

      // All initially visible widgets should be attached together, to reduce jitter and unnecessary DOM ops
      var freeToAttach = false;

      // the dom element for each area
      var areaToElement = {};

      // widget adapters waiting for their area to become available so that they may attach to its DOM
      var areaToWaitingAdapters = {};

      // the area name for each widget
      var widgetIdToArea = {};
      object.forEach( page.areas, function( widgets, areaName ) {
         widgets.forEach( function( widget ) {
            widgetIdToArea[ widget.id ] = areaName;
         } );
      } );

      // for each widget with children, and each widget area with nested areas, store a list of child names
      var areasInArea = {};
      var areasInWidget = {};
      object.forEach( page.areas, function( widgetEntries, areaName ) {
         var containerName = '';
         if( areaName.indexOf( '.' ) !== -1 ) {
            var widgetId = areaName.split( '.' )[ 0 ];
            areasInWidget[ widgetId ] = areasInWidget[ widgetId ] || [];
            areasInWidget[ widgetId ].push( areaName );
            containerName = widgetIdToArea[ widgetId ];
         }
         areasInArea[ containerName ] = areasInArea[ containerName ] || [];
         areasInArea[ containerName ].push( areaName );
      } );

      var visibilityByArea = {};

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function attachWaitingAdapters( areaName ) {
         var waitingAdapters = areaToWaitingAdapters[ areaName ];
         if( !waitingAdapters ) { return; }
         var element = areaToElement[ areaName ];
         if( !element ) { return; }

         q.all( waitingAdapters.map( function( adapter ) {
            return adapter.domPrepare();
         } ) ).then( function() {
            waitingAdapters.forEach( function( adapter ) {
               adapter.domAttachTo( element );
            } );
         } );

         // set bootstrap classes for first and last widget
         var first = element.firstChild;
         if( first ) { first.className = first.className + ' first'; }
         var last = element.lastChild;
         if( last ) { last.className = last.className + ' last'; }

         delete areaToWaitingAdapters[ areaName ];
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      return {
         setVisibility: function( areaName, visible ) {
            visibilityByArea[ areaName ] = visible;
            if( visible && freeToAttach ) {
               attachWaitingAdapters( areaName );
            }

         },
         areasInArea: function( containerName ) {
            return areasInArea[ containerName ];
         },
         areasInWidget: function( widgetId ) {
            return areasInWidget[ widgetId ];
         },
         /**
          * @param {String} name
          *    the area name as used in the page definition
          * @param {HTMLElement} element
          *    an HTML element representing the widget area
          */
         register: function( name, element ) {
            areaToElement[ name ] = element;
            if( visibilityByArea[ name ] ) {
               attachWaitingAdapters( name );
            }
            return function() {
               delete areaToElement[ name ];
            };
         },
         exists: function( name ) {
            return name in areaToElement;
         },
         prepareWidgets: function() {
            return q.when();
         },
         attachWidgets: function( widgetAdapters ) {
            freeToAttach = true;
            widgetAdapters.forEach( function( adapter ) {
               var areaName = widgetIdToArea[ adapter.widgetId() ];
               areaToWaitingAdapters[ areaName ] = areaToWaitingAdapters[ areaName ] || [];
               areaToWaitingAdapters[ areaName ].push( adapter );
            } );
            object.forEach( page.areas, function( widgets, areaName ) {
               if( visibilityByArea[ areaName ] ) {
                  attachWaitingAdapters( areaName );
               }
            } );
         }
      };

   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   module.directive( 'axPage', [ '$compile', function( $compile ) {

      var defaultAreas = [
         { name: 'activities', hidden: true },
         { name: 'popups' },
         { name: 'popovers' }
      ];

      return {
         restrict: 'A',
         template: '<div data-ng-class="layoutClass"></div>',
         replace: true,
         scope: true,
         controller: 'axPageController',
         link: function( scope, element, attrs, controller ) {

            controller.registerLayoutRenderer( function( layoutInfo ) {
               scope.layoutClass = layoutInfo.className;
               element.html( layoutInfo.htmlContent );
               $compile( element.contents() )( scope );

               var defaultAreaHtml = defaultAreas.reduce( function( html, area ) {
                  if( !controller.areas.exists( area.name ) ) {
                     return html + '<div data-ax-widget-area="' + area.name + '"' +
                            ( area.hidden ? ' style="display: none;"' : '' ) + '></div>';
                  }
                  return html;
               }, '' );

               if( defaultAreaHtml ) {
                  element.append( $compile( defaultAreaHtml )( scope ) );
               }
            } );

         }
      };

   } ] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return module;

} );
