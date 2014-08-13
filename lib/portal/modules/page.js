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
    * Mediates between FlowController and the stateful PageController
    */
   module.service( 'laxar.portal.PageService', [ function() {

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
    * Manages widget adapters and their DOM for the current page
    */
   module.controller( 'laxar.portal.PageController', [
      '$scope', 'laxar.portal.PageService', '$q', 'Configuration', 'LayoutLoader', 'EventBus', 'FileResourceProvider', 'ThemeManager',
      function( $scope, pageService, $q, configuration, layoutLoader, eventBus, fileResourceProvider, themeManager ) {

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

         function prepareDom() {
            return areaHelper_.prepareWidgets( widgetAdapters_ );
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function assembleDom() {
            areaHelper_.attachWidgets( widgetAdapters_ );
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
               .then( beginLifecycle )
               .then( visibilityManager.initialize )
               .then( localeManager.initialize )
               .then( publishTheme );

            $q.all( [ layoutDeferred.promise, pagePromise ] )
               .then( function( results ) {
                  renderLayout( results[ 0 ] );
                  return prepareDom();
               } )
               .then( assembleDom );

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

         function createLocaleManager() {
            // DEPRECATION: the key 'locales' has been deprecated in favor of 'i18n.locales'
            var configLocales_ = configuration.get( 'i18n.locales', configuration.get( 'locales', {} ) );
            var i18n;
            var initialized;

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function subscribe() {
               i18n = object.deepClone( configLocales_ );
               initialized = false;

               eventBus.subscribe( 'changeLocaleRequest', handleRequest, eventOptions );
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function handleRequest( event ) {
               i18n[ event.locale ] = event.languageTag;
               if( initialized ) {
                  publish( event.locale );
               }
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function initialize() {
               initialized = true;
               return $q.all( Object.keys( configLocales_ ).map( publish ) );
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function publish( locale ) {
               var event = { locale: locale, languageTag: i18n[ locale ] };
               return eventBus.publish( 'didChangeLocale.' + locale, event, eventOptions );
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function unsubscribe() {
               eventBus.unsubscribe( handleRequest );
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
          * The AreaVisibilityManager controls widget area visibility.
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

            /** First, ask if someone is responsible for managing this area's visibility. */
            function requestAreaChange( area, visible ) {
               var request = [ 'changeAreaVisibilityRequest', area ].join( '.' );
               var event = { area: area, visible: visible };
               return eventBus.publishAndGatherReplies( request, event, eventOptions ).then( function( responses ) {
                  if( responses.length === 0 ) {
                     // no one took responsibility, so the portal determines visibility by inheritance
                     return initiateAreaChange( area, visible );
                  }
                  // assume the first 'did'-response to be authoritative:
                  var response = responses[ 0 ];
                  return implementAreaChange( area, response.event.visible );
               } );
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            /** Set the new visibility state for the given area, then issue requests for the child areas */
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
               initialize: initialize
            };
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         this.setupPage = setupPage;
         this.tearDownPage = tearDownPage;
         this.registerLayoutRenderer = registerLayoutRenderer;
      }
   ] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function createAreaHelper( q, page ) {

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
            if( visible ) {
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
         controller: 'laxar.portal.PageController',
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
