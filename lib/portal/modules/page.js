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

   /** Mediates between FlowController and stateful PageController */
   module.service( 'portal.PageService', [ function() {

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
            // :TODO: identify a specific page
            return pageController;
         }
      };

   } ] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /** Manages widget controllers and their DOM for the current page */
   module.controller( 'portal.PageController', [
      '$scope', 'portal.PageService', '$q', 'Configuration', 'LayoutLoader', 'EventBus', 'FileResourceProvider', 'ThemeManager',
      function( $scope, pageService, $q, configuration, layoutLoader, eventBus, fileResourceProvider, themeManager ) {

         var self = this;
         var pageLoader_ = pageLoader.create( $q, null, paths.PAGES, fileResourceProvider );

         var theme = themeManager.getTheme();
         var localeManager = createLocaleManager();
         var widgetAdapters_ = [];
         var areaHelper_;
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

         function prepareDom() {
            return areaHelper_.prepareWidgets( widgetAdapters_ );
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function assembleDom( layoutInfo, widgetAdapters ) {
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
               .then( function() {
                  // manage visibility
               } )
               .then( localeManager.publishAll )
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
            var initiallyPublished;

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function subscribe() {
               i18n = object.deepClone( configLocales_ );
               initiallyPublished = false;

               eventBus.subscribe( 'changeLocaleRequest', handleRequest, eventOptions );
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function handleRequest( event ) {
               i18n[ event.locale ] = event.languageTag;
               if( initiallyPublished ) {
                  publish( event.locale );
               }
            }

            //////////////////////////////////////////////////////////////////////////////////////////////////

            function publishAll() {
               initiallyPublished = true;
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
               subscribe: subscribe,
               unsubscribe: unsubscribe,
               publishAll: publishAll
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

      var areaToElement = {};
      var areaToWaitingAdapters = {};
      var widgetIdToArea = {};
      object.forEach( page.areas, function( widgets, areaName ) {
         widgets.forEach( function( widget ) {
            widgetIdToArea[ widget.id ] = areaName;
         } );
      } );

      return {
         /**
          * @param {String} name
          *    the area name as used in the page definition
          * @param {HTMLElement} element
          *    an HTML element representing the widget area
          */
         register: function( name, element ) {
            areaToElement[ name ] = element;
            if( name in areaToWaitingAdapters ) {
               areaToWaitingAdapters[ name ].forEach( function( adapter ) {
                  adapter.domAttachTo( element );
               } );
            }
            return function() {
               delete areaToElement[ name ];
            };
         },
         exists: function( name ) {
            return name in areaToElement;
         },
         prepareWidgets: function( widgetAdapters ) {
            return q.all( widgetAdapters.map( function( adapter ) {
               return adapter.domPrepare();
            } ) );
         },
         attachWidgets: function( widgetAdapters ) {
            widgetAdapters.forEach( function( adapter ) {
               var areaName = widgetIdToArea[ adapter.widgetId() ];
               var areaElement = areaToElement[ areaName ];
               if( areaElement ) {
                  adapter.domAttachTo( areaElement );
               }
               else {
                  if( !areaToWaitingAdapters[ areaName ] ) {
                     areaToWaitingAdapters[ areaName ] = [];
                  }
                  areaToWaitingAdapters[ areaName ].push( adapter );
               }
            } );
         }
      };

   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   module.directive( 'axPage', [ '$compile', function( $compile ) {

      var defaultAreas = [ { name: 'activities', hidden: true }, { name: 'popups' }, { name: 'popovers' } ];

      return {
         restrict: 'A',
         template: '<div data-ng-class="layoutClass"></div>',
         replace: true,
         scope: true,
         controller: 'portal.PageController',
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

            //////////////////////////////////////////////////////////////////////////////////////////////////

            /*
            NEEDS FIX A: can we completely remove this?

            * data-added-by-page-directive

            scope.removeAddedDefaultWidgetAreas = function() {
               pageElement().children( '[data-added-by-page-directive]' ).each( function( i, child ) {
                  var el = ng.element( child );
                  el.scope().$destroy();
                  el.remove();
               } );
            };

            // prior to AngularJS 1.2.x element would reference the element where originally the
            // data-ax-page directive was set on. Possibly due to changes to ng-include in 1.2.x element
            // now only is the HTML comment marking the place where ng-include once was. We therefore
            // need to find the correct element again manually.
            function pageElement() {
              return $( 'body' ).find( '[data-ax-page]:first,[ax-page]:first' ).eq( 0 );
            }

            */
         }
      };


   } ] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /*
   var theme_;

   module.controller( 'portal.PageController', [
      '$timeout', '$rootScope', '$scope',

      function( $timeout, $rootScope, $scope ) {
         $scope.widgetAreas = [];

         var eventOptions = { sender: 'PageController' };
         var previousLayout = null;

         eventBus_.subscribe( 'loadPageRequest', function( event ) {
            loadTimer.resumeOrCreate();
            eventBus_.publish( 'willLoadPage', {}, eventOptions );
            var pageName = event.page;
            var currentPage = null;

            theme_ = themeManager_.getTheme();

            $rootScope.allWidgetsLoaded = false;

            $scope.layoutLoaded = function() {
               $scope.layoutLoaded = function() {};

               $scope.addMissingDefaultWidgetAreas();

               loadPageWidgets( $scope, currentPage )
                  .then( function() {
                     $rootScope.allWidgetsLoaded = true;
                     eventBus_.publish( 'didLoadPage', {}, eventOptions );
                  }, function( error ) {
                     eventBus_.publish( 'didLoadPage', { error: error }, eventOptions );
                  }
               );
            };

            pageLoader_.loadPage( pageName )
               .then( function( page ) {
                  currentPage = page;
                  return loadLayout( $timeout, $scope, page.layout, previousLayout );
               } )
               .then( function( layout ) {
                  previousLayout = layout;
               }, function( error ) {
                  log.error( '[0:%o]', error );
               } );

         }, { subscriber: eventOptions.sender } );
      }
   ] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function loadLayout( $timeout, $scope, layout, previousLayout ) {
      $scope.removeAddedDefaultWidgetAreas();

      return layoutLoader_.load( layout, previousLayout )
         .then( function( newLayoutData ) {
            if( !newLayoutData.html ) {
               throw new Error( 'Could not find HTML for layout "' + layout + '"' );
            }

            $scope.widgets = {};
            $scope.layoutClass = newLayoutData.className;
            if( layout !== previousLayout ) {
               $scope.layout = newLayoutData.html;
            }
            else {
               // This double-$timeout is needed to make sure that the onload event fires reliably!
               $timeout( function() {
                  $scope.layout = null;
                  $timeout( function() {
                     $scope.layout = newLayoutData.html;
                  } );
               } );
            }

            return layout;
         } );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function loadPageWidgets( $scope, page ) {
      loadTimer.split( 'loading page' );
      var deferred = q_.defer();
      var widgetsForPage = widgetLoaderModule.processWidgetsForPage( page );

      var remaining = widgetsWithoutArea( $scope.widgetAreas, widgetsForPage );

      var loading = widgetsForPage.length - remaining.length;
      var loadingIncludeContent = 0;

      var scopeEventListeners = [
         $scope.$on( 'axPortal.loadedWidget', function( ) {
            --loading;

            var oldRemaining = remaining;
            remaining = widgetsWithoutArea( $scope.widgetAreas, oldRemaining );

            loading += oldRemaining.length - remaining.length;

            if( loading === 0 && remaining.length === 0 ) {
               done();
            }

            checkForPossibleError();
         } ),

         $scope.$on( 'axLayoutLoading', function( ) {
            ++loadingIncludeContent;
         } ),

         $scope.$on( 'axLayoutLoaded', function( ) {
            --loadingIncludeContent;

            // here we may have some new widget areas
            var oldRemaining = remaining;
            remaining = widgetsWithoutArea( $scope.widgetAreas, oldRemaining );

            loading += oldRemaining.length - remaining.length;

            checkForPossibleError();
         } )
      ];

      loadWidgetSpecifications( widgetsForPage )
         .then( function( loadedWidgets ) {
            loadTimer.split( 'specs loaded' );
            $scope.widgets = {};
            loadedWidgets.forEach( function( widget ) {
               if( !( widget.area in $scope.widgets ) ) {
                  $scope.widgets[ widget.area ] =  [];
               }
               $scope.widgets[ widget.area ].push( widget );
            } );

            if( widgetsForPage.length === 0 ) {
               log.debug( 'no widgets to load for current page' );
               done();
            }
         }, function( e ) {
            done( e );
         } );


      checkForPossibleError();

      return deferred.promise;

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function checkForPossibleError() {
         if( loadingIncludeContent === 0 && loading === 0 && remaining.length > 0 ) {
            log.error( 'Some widgets are in no existing widget area and thus cannot be loaded: [0]', remaining );
            done( remaining.length + ' widgets are in no existing widget area and thus cannot be loaded' );
         }
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function done( error ) {
         loadTimer.split( 'widgets instantiated' ).save();
         scopeEventListeners.forEach( function( off ) { off(); } );
         if( error ) {
            deferred.reject( error );
         }
         else {
            deferred.resolve();
         }
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   var loadTimer = ( function() {
      var FLOW_SESSION_KEY = 'FlowManager';
      var FLOW_SESSION_KEY_TIMER = 'navigationTimer';
      var sessionStore = storage.getSessionStorage( FLOW_SESSION_KEY );
      var timer_;

      return {
         resumeOrCreate: resumeOrCreate,
         split: split,
         save: save
      };

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function split( checkpoint ) {
         timer_.splitTime( checkpoint );
         return loadTimer;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function resumeOrCreate() {
         var timerData = sessionStore.getItem( FLOW_SESSION_KEY_TIMER );
         timer_ = timerData ? timer.resume( timerData ) : timer.startedTimer( 'pageLoadTimer' );
         sessionStore.setItem( FLOW_SESSION_KEY_TIMER, timer_.save() );
         return loadTimer;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function save() {
         storage.getSessionStorage( FLOW_SESSION_KEY ).setItem( FLOW_SESSION_KEY_TIMER, timer_.save() );
         return loadTimer;
      }

   } )();

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function loadWidgetSpecifications( widgets ) {
      return q_.all( widgets.map( function( requestedConfiguration ) {
         return widgetLoaderModule.resolveWidget( requestedConfiguration.widget, theme_ )
            .then( function( resolved ) {
               var widget = {};
               ng.extend( widget, resolved );
               ng.extend( widget, requestedConfiguration );

               widget._scopeProperties = {
                  features: widgetLoaderModule.featuresForWidget( resolved.specification, requestedConfiguration ),
                  layout: null // shadow the layout property of the rootScope for widgets (jira ATP-7065)
               };

               return widget;
            } );
      } ) );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function widgetsWithoutArea( existingAreas, widgets ) {
      return widgets.reduce( function( remaining, widget ) {
         if( existingAreas.indexOf( widget.area ) !== -1 ) {
            return remaining;
         }

         return remaining.concat( widget );
      }, [] );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////
    */

   return module;

} );
