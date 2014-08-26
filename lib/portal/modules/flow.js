/**
 * Copyright 2014 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
define( [
   'angular',
   'angular-route',
   '../../logging/log',
   '../../json/validator',
   '../../utilities/object',
   '../../utilities/storage',
   '../paths',
   '../timer',
   'json!../../../static/schemas/flow.json'
], function( ng, ngRoute, log, jsonValidator, object, storage, paths, timer, flowSchema ) {
   'use strict';

   var module = ng.module( 'laxar.portal.flow', [ 'ngRoute' ] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   var $routeProvider_;

   module.config( [ '$routeProvider', function( $routeProvider ) {
      $routeProvider_ = $routeProvider;
   } ] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   var $http_;
   var $q_;
   var fileResourceProvider_;
   var exitPoints_;
   var entryPoint_;

   module.run( [
      '$route', '$http', '$q', 'Configuration', 'FileResourceProvider',

      function( $route, $http, $q, Configuration, fileResourceProvider ) {
         $http_ = $http;
         fileResourceProvider_ = fileResourceProvider;
         $q_ = $q;

         // DEPRECATION: the key 'entryPoint' has been deprecated in favor of 'portal.flow.entryPoint'
         entryPoint_ = Configuration.get( 'portal.flow.entryPoint' ) || Configuration.get( 'entryPoint' );
         // DEPRECATION: the key 'exitPoints' has been deprecated in favor of 'portal.flow.exitPoints'
         exitPoints_ = Configuration.get( 'portal.flow.exitPoints' ) || Configuration.get( 'exitPoints' );

         // idea for lazy loading routes using $routeProvider and $route.reload() found here:
         // https://groups.google.com/d/msg/angular/mrcy_2BZavQ/Mqte8AvEh0QJ
         loadFlow( paths.FLOW_JSON ).then( function() {
            $route.reload();
         } );
      } ]
   );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   var TARGET_SELF = '_self';
   var places_;
   var previousPlaceParameters_;
   var currentTarget_ = TARGET_SELF;
   var navigationInProgress_ = false;

   var eventOptions = { sender: 'FlowController' };
   var subscriberOptions = { subscriber: 'FlowController' };

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   module.controller( 'portal.FlowController', [
      '$window', '$location', '$routeParams', '$rootScope', 'place', 'EventBus', 'axPageService',

      function FlowController( $window, $location, $routeParams, $rootScope, place, eventBus, pageService ) {
         // The flow controller is instantiated on route change by AngularJS. It then announces the start of
         // navigation ("willNavigate") and initiates loading of the new page. As soon as the new page is
         // loaded, the "didNavigate" event finishes the navigation logic. The flow controller then starts to
         // listen for subsequent navigateRequests.

         var previousPlace = $rootScope.place;
         var page = place.page;
         $rootScope.place = place;

         if( typeof place.exitFunction === 'string' ) {
            var exit = place.exitFunction;
            if( exitPoints_ && typeof exitPoints_[ exit ] === 'function' ) {
               var placeParameters = constructNavigationParameters( $routeParams, place );
               exitPoints_[ exit ]( placeParameters );
               return;
            }
            throw new Error( 'Exitpoint "' + exit + '" does not exist.' );
         }

         navigationInProgress_ = true;
         var navigateEvent = { target: currentTarget_ };
         var didNavigateEvent =  object.options( { data: {}, place: place.id }, navigateEvent );

         eventBus.publish( 'willNavigate.' + currentTarget_, navigateEvent, eventOptions )
            .then( function() {
               var parameters = constructNavigationParameters( $routeParams, place );
               didNavigateEvent.data = parameters;
               previousPlaceParameters_ = parameters;

               if( place === previousPlace ) {
                  return finishNavigation( currentTarget_, didNavigateEvent );
               }

               return pageService.controller().tearDownPage()
                  .then( function() {
                     navigationTimer.resumeOrCreate( place );
                     return pageService.controller().setupPage( page );
                  } )
                  .then( function() {
                     navigationTimer.stop();
                     return finishNavigation( currentTarget_, didNavigateEvent );
                  } );
            } )
            .then( null, function( error ) {
               log.error( error );
            } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function handleNavigateRequest( event, actions ) {
            if( navigationInProgress_ ) {
               // make sure that at most one navigate request be handled at the same time
               return;
            }
            navigationInProgress_ = true;

            currentTarget_ = event.target;
            var placeName = findPlaceForNavigationTarget( event.target, place );
            var parameters = object.extend( {}, previousPlaceParameters_ || {}, event.data || {} );
            var newPlace = places_[ placeName ];

            navigationTimer.start( place, newPlace );
            if( newPlace.triggerBrowserReload || event.triggerBrowserReload ) {
               triggerReload( placeName, parameters );
               return;
            }

            var newPath = constructLocation( placeName, parameters );
            if( newPath !== $location.path() ) {
               $location.path( newPath );
               // this will instantiate another flow controller
               actions.unsubscribe();
            }
            else {
               // nothing to do:
               navigationInProgress_ = false;
            }
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function triggerReload( placeName, parameters ) {
            eventBus.publish( 'willNavigate.' + currentTarget_, navigateEvent, eventOptions )
               .then( function() {
                  return pageService.controller().tearDownPage();
               } )
               .then( function() {
                  var path = constructLocation( placeName, parameters );
                  var url = '' + $window.location.href;
                  var newUrl = url.split( '#' )[ 0 ] + '#' + path;
                  // Prevent angular from entering a loop of location changes during digest
                  // by pretending that we have already navigated. This is actually true, because
                  // we do navigate ourselves using location.reload.
                  $location.absUrl = function() {
                     return $window.location.href;
                  };

                  $window.location.href = newUrl;
                  $window.location.reload();
               } );
         }

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         function finishNavigation( currentTarget_, didNavigateEvent ) {
            eventBus.subscribe( 'navigateRequest', handleNavigateRequest, subscriberOptions );
            navigationInProgress_ = false;
            return eventBus.publish( 'didNavigate.' + currentTarget_, didNavigateEvent, eventOptions );
         }

      }
   ] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   var navigationTimer = (function() {
      var SESSION_KEY = 'FlowManager';
      var SESSION_KEY_TIMER = 'navigationTimer';
      var sessionStore = storage.getSessionStorage( SESSION_KEY );

      return {
         start: start,
         resumeOrCreate: resumeOrCreate,
         stop: stop
      };

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function start( from, to ) {
         var label = [
            'navigation (', from ? from.targets._self : '', ' -> ', to.targets._self, ')'
         ].join( '' );
         var t = timer.startedTimer( label );
         sessionStore.setItem( SESSION_KEY_TIMER, t.save() );
         return t;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function resumeOrCreate( place ) {
         var timerData = sessionStore.getItem( SESSION_KEY_TIMER );
         var t;
         if( timerData ) {
            t = timer.resume( timerData );
         }
         else {
            var label = [ 'loadTimer (', place.target ? place.target._self : place.id, ')' ].join( '' );
            t = timer.startedTimer( label );
         }
         sessionStore.setItem( SESSION_KEY_TIMER, t.save() );
         return t;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function stop() {
         var timerData = sessionStore.getItem( SESSION_KEY_TIMER );
         if( timerData ) {
            var t = timer.resume( timerData );
            t.stopAndLog( 'beginLifecycleRequest' );
            sessionStore.removeItem( SESSION_KEY_TIMER );
         }
      }

   } )();

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function constructNavigationParameters( $routeParams, place ) {
      var placeParameters = {};
      var params = place.fixedParameters || $routeParams;
      object.forEach( place.expectedParameters, function( parameterName ) {
         if( typeof params[ parameterName ] === 'undefined' ) {
            placeParameters[ parameterName ] = null;
         }
         else {
            placeParameters[ parameterName ] = decodePlaceParameter( params[ parameterName ] );
         }
      } );

      return placeParameters;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function constructLocation( placeName, parameters ) {
      var place = places_[ placeName ];
      var location = '/' + placeName;

      object.forEach( place.expectedParameters, function( parameterName ) {
         location += '/';
         if( parameterName in parameters && parameters[ parameterName ] !== null ) {
            location += encodePlaceParameter( parameters[ parameterName ] );
         }
      } );

      return location;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function findPlaceForNavigationTarget( targetOrRoute, activePlace ) {
      if( 'targets' in activePlace ) {
         var targets = activePlace.targets;
         if( targetOrRoute in targets ) {
            return findPlaceForNavigationTarget( targets[ targetOrRoute ], activePlace );
         }
      }

      if( targetOrRoute in places_ ) {
         return targetOrRoute;
      }

      log.error( 'unknown target or place "[0]".', targetOrRoute );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function loadFlow( flowFile ) {
      return fetchPlaces( flowFile )
         .then( function( places ) {
            places_ = processPlaceParameters( places );

            object.forEach( places_, function( place, routeName ) {
               assembleRoute( routeName, place );
            } );

            $routeProvider_.otherwise( {
               redirectTo: '/entry'
            } );
         } );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function assembleRoute( routeName, place ) {
      if( place.redirectTo ) {
         $routeProvider_.when( '/' + routeName, {
            redirectTo: place.redirectTo
         } );
         return;
      }

      if( place.entryPoints ) {
         $routeProvider_.when( '/' + routeName, {
            redirectTo: routeByEntryPoint( place.entryPoints )
         } );
         return;
      }

      $routeProvider_.when( '/' + routeName, {
         template: '<!---->',
         controller: 'portal.FlowController',
         resolve: {
            place: function() {
               return place;
            }
         }
      } );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function routeByEntryPoint( possibleEntryPoints ) {
      var entryPoint = entryPoint_ || { target: 'default', parameters: {} };

      var placeName = possibleEntryPoints[ entryPoint.target ];
      if( placeName ) {
         var targetPlace = places_[ placeName ];
         var uri = placeName;

         object.forEach( targetPlace.expectedParameters, function( parameterName ) {
            var param = entryPoint.parameters[ parameterName ] || '';
            uri += '/' + encodePlaceParameter( param );
         } );

         return uri;
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   var ROUTE_PARAMS_MATCHER = /\/:([^\/]+)/ig;

   function processPlaceParameters( places ) {
      var processedRoutes = {};

      object.forEach( places, function( place, placeName ) {
         place.expectedParameters = [];
         place.id = placeName;

         if( !place.targets ) {
            place.targets = {};
         }
         if( !place.targets[ TARGET_SELF ] ) {
            place.targets[ TARGET_SELF ] = placeName.split( /\/:/ )[0];
         }

         var matches;
         while( ( matches = ROUTE_PARAMS_MATCHER.exec( placeName ) ) ) {
            var routeNameWithoutParams = placeName.substr( 0, matches.index );

            place.expectedParameters.push( matches[ 1 ] );

            processedRoutes[ routeNameWithoutParams ] = place;
         }
         processedRoutes[ placeName ] = place;
      } );

      return processedRoutes;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function fetchPlaces( flowFile ) {
      // NEEDS FIX C: Switch to using file resource provider here as well
      return $http_.get( flowFile )
         .then( function( response ) {
            var flow = response.data;

            validateFlowJson( flow );

            return flow.places;
         }, function( err ) {
            throw new Error( 'Failed to load "' + flowFile + '". Cause: ' + err );
         } );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function validateFlowJson( flowJson ) {
      var result = jsonValidator.create( flowSchema ).validate( flowJson );

      if( result.errors.length ) {
         result.errors.forEach( function( error ) {
            log.error( '[0]', error.message );
         } );

         throw new Error( 'Illegal flow.json format' );
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function encodePlaceParameter( value ) {
      return typeof value === 'string' ? value.replace( /\//g, '%2F' ) : value;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function decodePlaceParameter( value ) {
      return typeof value === 'string' ? value.replace( /%2F/g, '/' ) : value;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return module;

} );
