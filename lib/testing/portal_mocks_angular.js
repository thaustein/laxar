/**
 * Copyright 2014 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
define( [
   'require',
   'jquery',
   'angular-mocks',
   '../utilities/object',
   '../event_bus/event_bus',
   '../logging/log',
   '../logging/channels/console_logger',
   '../portal/portal_assembler/widget_adapters/angular_adapter',
   '../portal/portal_assembler/widget_loader',
   '../portal/portal_assembler/features_provider',
   '../portal/modules/theme_manager',
   './portal_mocks'
], function( require, $, angularMocks, object, eventBusModule, log, consoleChannel, angularWidgetAdapter, widgetLoaderModule, featuresProvider, themeManager, portalMocks ) {
   'use strict';

   var TICK_CONSTANT = 101;

   log.setLogThreshold( 'DEVELOP' );
   log.addLogChannel( consoleChannel );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function createControllerTestBed( moduleName, controllerName ) {
      jasmine.Clock.useMock();

      var testBed = {
         moduleName: moduleName,
         controllerName: controllerName || 'Controller',
         tick: function( milliseconds ) {
            jasmine.Clock.tick( milliseconds || 0 );
         },
         nextTick: function() {
            testBed.tick( TICK_CONSTANT );
         }
      };

      initTestBed( testBed );

      testBed.usingWidgetJson = false;
      testBed.useWidgetJson = createUseWidgetJsonFunction( testBed, moduleName );

      testBed.setup = function( optionalOptions ) {

         var options = testBed.options = object.options( optionalOptions, {
            defaultLanguageTag: 'en',
            simulatePortalEvents: false,
            theme: 'default'
         } );

         testBed.eventBusMock = createEventBusMock( testBed.scope );

         testBed.usingWidgetJson = true;
         var widget = moduleName.replace( /^widgets\./, '' ).replace( /\./g, '/' );
         var widgetConfiguration = {
            widget: widget,
            features: object.deepClone( testBed.featuresMock )
         };

         getWidgetLoader( testBed ).load( widgetConfiguration )
            .then( function( widgetJson ) {
               testBed.widgetMock = object.extend( widgetJson, { id: 'testWidgetId' } );
            }, function( err ) {
               /*global console*/
               console.error( 'There was an error resolving widget for module ' + moduleName );
               console.error( err );
            } );

         jasmine.Clock.tick( 0 );

         if( options.simulatePortalEvents ) {
            simulatePortalEvents( testBed, testBed.injections.$q, options );
         }
      };

      testBed.tearDown = function() {
         if( testBed.scope && testBed.scope.$destroy ) {
            testBed.scope.$destroy();
         }
         
         initTestBed( testBed );
         eventBusModule.init( null, null, null );
      };

      return testBed;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function simulatePortalEvents( testBed, $q, options ) {
      var eventOptions = { sender: 'FlowController' };
      var next = $q.when();
      if( options.defaultLanguageTag ) {
         next = next.then( function() {
            return testBed.eventBusMock.publish( 'didChangeLocale.default', {
               locale: 'default',
               languageTag: options.defaultLanguageTag
            }, eventOptions );
         } );
      }
      next.then( function() {
         return testBed.eventBusMock.publish( 'didChangeTheme.default', {
            theme: 'default'
         }, eventOptions );
      } ).then( function() {
         return testBed.eventBusMock.publishAndGatherReplies( 'beginLifecycleRequest.default', {
            lifecycleId: 'default'
         }, eventOptions );
      } ).then( function() {
         return testBed.eventBusMock.publish( 'didNavigate.default', {
            target: 'default',
            place: 'testPlace',
            data: {}
         }, eventOptions );
      } );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function mockQ( scope ) {
      return scope ? wrapQ( portalMocks.mockQ(), scope ) : portalMocks.mockQ();
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function mockAngularTimeout( scope ) {
      var mockTick = portalMocks.mockTick();
      return function $timeoutMock( callback, timeout ) {
         mockTick( function() { scope.$apply( callback ); }, timeout  );
      };
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function wrapQ( q, scope ) {
      var wrapper = object.options( {}, q );
      var originalDefer = wrapper.defer;

      wrapper.defer = function() {
         var deferred = originalDefer.apply( wrapper, arguments );
         var originalResolve = deferred.resolve;

         deferred.resolve = function() {
            var resolved = originalResolve.apply( deferred, arguments );
            if( scope.$$phase === null ) {
               scope.$digest();
            }

            return resolved;
         };

         return deferred;
      };

      return wrapper;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function initTestBed( testBed ) {
      testBed.widgetMock = createWidgetMock();
      testBed.featuresMock = {};
      testBed.injections = {};

      delete testBed.scope;
      delete testBed.controller;

      return testBed;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function createEventBusMock( scope ) {
      var timeoutFunction = function( cb, timeout ) {
         setTimeout( function() {
            cb();
            if( !scope.$$phase ) {
               scope.$digest();
            }
         }, timeout || 0 );
      };
      eventBusModule.init( portalMocks.mockQ(), timeoutFunction, timeoutFunction );

      var eventBusMock = eventBusModule.create();

      spyOn( eventBusMock, 'subscribe' ).andCallThrough();
      spyOn( eventBusMock, 'publish' ).andCallThrough();
      spyOn( eventBusMock, 'publishAndGatherReplies' ).andCallThrough();

      return eventBusMock;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   var cache = {};
   var misses = {};
   function getWidgetLoader( testBed ) {
      var q = portalMocks.mockQ();
      var fileResourceProvider = {
         provide: function( url ) {
            var deferred = q.defer();
            if( cache[ url ] ) {
               deferred.resolve( object.deepClone( cache[ url ] ) );
            }
            else if( misses[ url ] ) {
               deferred.reject( misses[ url ] );
            }
            else {
               // Support for very old servers: undefined by default to infer type from response header.
               var dataTypeGuess;
               if( url.indexOf( '.json' ) === url.length - 5 ) {
                  dataTypeGuess = 'json';
               }
               $.support.cors = true;
               $.ajax( {
                  url: url,
                  dataType: dataTypeGuess,
                  async: false,
                  success: function( data ) {
                     cache[ url ] = object.deepClone( data );
                     deferred.resolve( data );
                  },
                  error: function( xhr, status, err ) {
                     misses[ url ] = err;
                     deferred.reject( err );
                  }
               } );
            }

            return deferred.promise;
         },
         isAvailable: function( url ) {
            return fileResourceProvider.provide( url )
               .then( function() {
                  return true;
               }, function() {
                  return false;
               } );
         }
      };

      return widgetLoaderModule.create( q, fileResourceProvider, testBed.eventBusMock, {
         theme: 'default',
         adapters: {
            angular: portalMocksAngularAdapter( testBed )
         }
      } );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /** This is for backwards-compatibility only. */
   function createUseWidgetJsonFunction( testBed ) {
      return function() {
         if( arguments.length && console.error ) {
            console.error( 'To set a theme for the widget testBed, use setup-options, not useWidgetJson!' );
         }
         return testBed;
      };
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function createEventBusForWidget( eventBus, widget ) {
      var collaboratorId = 'widget.' + widget.specification.name + '#' + widget.id;
      function forward( to ) {
         return function() {
            return eventBus[ to ].apply( eventBus, arguments );
         };
      }

      function augmentOptions( optionalOptions ) {
         return object.options( optionalOptions, { sender: collaboratorId } );
      }

      var bus = {
         addInspector: forward( 'addInspector' ),
         setErrorHandler: forward( 'setErrorHandler' ),
         setMediator: forward( 'setMediator' ),
         unsubscribe: forward( 'unsubscribe' ),
         subscribe: function( eventName, subscriber, optionalOptions ) {
            var options = object.options( optionalOptions, { subscriber: collaboratorId } );
            return eventBus.subscribe( eventName, subscriber, options );
         },
         publish: function( eventName, optionalEvent, optionalOptions ) {
            return eventBus.publish( eventName, optionalEvent, augmentOptions( optionalOptions ) );
         },
         publishAndGatherReplies: function( eventName, optionalEvent, optionalOptions ) {
            return eventBus.publishAndGatherReplies( eventName, optionalEvent, augmentOptions( optionalOptions ) );
         }
      };
      spyOn( bus, 'subscribe' ).andCallThrough();
      spyOn( bus, 'publish' ).andCallThrough();
      spyOn( bus, 'publishAndGatherReplies' ).andCallThrough();
      return bus;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function createWidgetMock() {
      return {
         id: 'testWidgetId',
         specification: {
            name: 'test/test_widget',
            description: 'test widget',
            integration: {
               type: 'angular'
            }
         }
      };
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   var angularInjectionDone = false;
   var $rootScope = null;
   var $provide;
   var $controller;

   function portalMocksAngularAdapter( testBed ) {

      function create( q, fileResourceProvider, specification, features, widgetConfiguration, anchorElement ) {

         angularMocks.module( testBed.moduleName, function( _$provide_ ) {
            $provide = _$provide_;
            $provide.service( 'EventBus', function() { return testBed.eventBusMock; } );
         } );

         if( !angularInjectionDone ) {
            console.log( 'injecting for module', testBed.moduleName ); // :TODO: Delete
            angularMocks.inject( function( _$rootScope_, _$controller_ ) {
               $rootScope = _$rootScope_;
               $controller = _$controller_;
            } );
            angularInjectionDone = true;
         }

         // Initialize i18n for i18n controls in non-i18n widgets
         $rootScope.i18n = {
            locale: 'default',
            tags: {
               'default': testBed.options.defaultLanguageTag
            }
         };

         function createController( widgetServices, configuration ) {
            testBed.scope = $rootScope.$new();
            var injections = object.options( testBed.injections, {
               $scope: testBed.scope,
               $q: mockQ( testBed.scope ),
               $timeout: mockAngularTimeout( testBed.scope )
            } );

            testBed.scope.features = features;
            testBed.scope.id = widgetServices.idGenerator;

            // NEEDS FIX A: tearDown
            var eventBus = widgetServices.eventBus;
            spyOn( eventBus, 'subscribe' ).andCallThrough();
            spyOn( eventBus, 'publish' ).andCallThrough();
            spyOn( eventBus, 'publishAndGatherReplies' ).andCallThrough();
            testBed.scope.eventBus = eventBus;
            testBed.controller = $controller( testBed.moduleName + '.' + testBed.controllerName, injections );

            testBed.scope.$digest();
         }

         return {
            createController: createController
         };
      }

      return {
         create: create
      };
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return {

      addMatchersTo: portalMocks.addMatchersTo,
      any: portalMocks.any,
      anyRemaining: portalMocks.anyRemaining,

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * Creates a test bed for widget controller tests.
       *
       * @param {String} moduleName
       *    the name of the module the controller belongs to
       * @param {String} [controllerName]
       *    the name of the controller. If omitted, "Controller" will be used
       *
       * @return {Object}
       *    A controller test bed having the following properties:
       *
       *    @property {Object}   widgetMock   The widget specification
       *    @property {Object}   featureMock  The configured widget features
       *    @property {Object}   eventBusMock The message bus
       *    @property {Object}   injections   Services to inject into the controller
       *    @property {Object}   scope        The controller scope
       *    @property {Function} controller   The controller
       */
      createControllerTestBed: createControllerTestBed,

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * Creates a basic widget specification (i.e. a widget.json structure).
       *
       * @return {Object}
       *    a widget specification object
       */
      mockWidget: createWidgetMock,

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * Creates a mock implementation of the Q API.
       * @see https://github.com/kriskowal/q
       *
       * @return {Object} A Q mock implementation.
       */
      mockQ: mockQ,

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * Creates a mocked tick function.
       *
       * @return {Function} A mocked tick function.
       */
      mockTick: portalMocks.mockTick,

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      /**
       * Creates a mock for a http client.
       *
       * @return {Object} A http client mock.
       */
      mockHttp: portalMocks.mockHttp

   };
} );
