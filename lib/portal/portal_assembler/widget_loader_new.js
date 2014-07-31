/**
 * Copyright 2014 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
define( [
   '../../json/validator',
   '../../json/json_patch_compatibility',
   '../../logging/log',
   '../../utilities/path',
   '../../utilities/assert',
   '../../utilities/object',
   '../../utilities/string',
   '../paths',
   './widget_adapters/native_adapter',
   './widget_adapters/angular_adapter'
], function(
   jsonValidator,
   jsonPatchCompatibility,
   log,
   path,
   assert,
   object,
   string,
   paths,
   nativeAdapter,
   angularAdapter
) {
   'use strict';

   var TYPE_WIDGET = 'widget';
   var TYPE_ACTIVITY = 'activity';
   var TECHNOLOGY_ANGULAR = 'angular';
   var TECHNOLOGY_NATIVE = 'native';

   var INVALID_ID_MATCHER = /[^A-Za-z0-9-_\.]/g;

   // JSON schema formats:
   var TOPIC_IDENTIFIER = '([a-z][+a-zA-Z0-9]*|[A-Z][+A-Z0-9]*)';
   var SUB_TOPIC_FORMAT = new RegExp( '^' + TOPIC_IDENTIFIER + '$' );
   var TOPIC_FORMAT = new RegExp( '^(' + TOPIC_IDENTIFIER + '(-' + TOPIC_IDENTIFIER + ')*)$' );
   var FLAG_TOPIC_FORMAT = new RegExp( '^[!]?(' + TOPIC_IDENTIFIER + '(-' + TOPIC_IDENTIFIER + ')*)$' );
   // simplified RFC-5646 language-tag matcher with underscore/dash relaxation:
   // the parts are: language *("-"|"_" script|region|variant) *("-"|"_" extension|privateuse)
   var LANGUAGE_TAG_FORMAT = /^[a-z]{2,8}([-_][a-z0-9]{2,8})*([-_][a-z0-9][-_][a-z0-9]{2,8})*$/i;

   var adapters = {};
   adapters[ TECHNOLOGY_ANGULAR ] =  angularAdapter;
   adapters[ TECHNOLOGY_NATIVE ] = nativeAdapter;

   function create( q, fileResourceProvider, eventBus, configuration ) {

      assert( q ).hasType( Object ).isNotNull();
      assert( fileResourceProvider ).hasType( Object ).isNotNull();
      assert( configuration ).hasType( Object ).isNotNull();
      assert( configuration.theme ).hasType( String ).isNotNull();

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function load( widgetConfiguration ) {
         var widgetJsonPath = path.join( paths.WIDGETS, widgetConfiguration.widget, 'widget.json' );
         var promise = fileResourceProvider.provide( widgetJsonPath );

         return promise
            .then( function( specification ) {
               var type = specification.integration.type;
               var technology = specification.integration.technology || TECHNOLOGY_ANGULAR;

               // Handle legacy widget code:
               if( type === TECHNOLOGY_ANGULAR ) {
                  type = TYPE_WIDGET;
               }
               if( !( technology in adapters ) ) {
                  throwError( widgetConfiguration, 'unknown integration technology ' + technology );
               }
               if( type !== TYPE_WIDGET && type !== TYPE_ACTIVITY ) {
                  throwError( widgetConfiguration, 'unknown integration type ' + type );
               }

               var features = featuresForWidget( specification, widgetConfiguration );
               var widgetEventBus = createEventBusForWidget( eventBus, specification, widgetConfiguration );
               var idGenerator = createIdGeneratorForWidget( widgetConfiguration.id );
               var adapter = adapters[ technology ]
                  .create( q, fileResourceProvider, specification, features, widgetConfiguration );

               adapter.createController( widgetEventBus, idGenerator, configuration );
               return adapter;
            } );
      }

      ///////////////////////////////////////////////////////////////////////////////////////////////////////////

      return {
         load: load
      };
   }

   ////////////////////////////////////////////////////////////////////////////////////////////////////////

   function throwError( widgetConfiguration, message ) {
      throw new Error( string.format(
         'Error loading widget "[widget]" (id: "[id]"): [0]', [ message ], widgetConfiguration
      ) );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   // NEEDS FIX A: Make available or remove
   function restoreWidgetStorage( widgetStorage, place, widget ) {
      var data = widgetStorage.getItem( place.id + '#' + widget.id );
      return typeof data === 'object' && data != null ? data : {};
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   // NEEDS FIX A: Make available or remove
   function persistWidgetStorage( widgetStorage, place, widget, data ) {
      if( typeof data === 'object' && data != null && Object.keys( data ).length > 0 ) {
         widgetStorage.setItem( place.id + '#' + widget.id, data );
      }
      else {
         widgetStorage.removeItem( place.id + '#' + widget.id );
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function featuresForWidget( widgetSpecification, widgetConfiguration ) {
      if( !widgetSpecification.features ) {
         return {};
      }

      var featureConfiguration = widgetConfiguration.features || {};
      var featuresSpec = widgetSpecification.features;
      if( !( '$schema' in featuresSpec ) ) {
         // we assume an "old style" feature specification (i.e. first level type specification is omitted)
         // if no schema version was defined.
         featuresSpec = {
            $schema: 'http://json-schema.org/draft-03/schema#',
            type: 'object',
            properties: widgetSpecification.features
         };
      }

      object.forEach( widgetSpecification.features, function( feature, name ) {
         // ensure that simple object features are at least defined
         if( feature.type === 'object' && !( name in featureConfiguration ) ) {
            featureConfiguration[ name ] = {};
         }
      } );

      var validator = createFeaturesValidator( featuresSpec );
      var report = validator.validate( featureConfiguration );

      if( report.errors.length > 0 ) {
         var message = 'Validation for widget features failed. Errors: ';

         report.errors.forEach( function( error ) {
            message += '\n - ' + error.message.replace( /\[/g, '\\[' );
         } );

         throwError( message );
      }

      deriveFirstLevelDefaults( featureConfiguration, featuresSpec );

      return featureConfiguration;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function createFeaturesValidator( featuresSpec ) {
      var validator = jsonValidator.create( featuresSpec, {
         prohibitAdditionalProperties: true,
         useDefault: true
      } );

      // allows 'mySubTopic0815', 'MY_SUB_TOPIC+OK' and variations:
      validator.addFormat( 'sub-topic', function( subTopic ) {
         return ( typeof subTopic !== 'string' ) || SUB_TOPIC_FORMAT.test( subTopic );
      } );

      // allows 'myTopic', 'myTopic-mySubTopic-SUB_0815+OK' and variations:
      validator.addFormat( 'topic', function( topic ) {
         return ( typeof topic !== 'string' ) || TOPIC_FORMAT.test( topic );
      } );

      // allows 'myTopic', '!myTopic-mySubTopic-SUB_0815+OK' and variations:
      validator.addFormat( 'flag-topic', function( flagTopic ) {
         return ( typeof flagTopic !== 'string' ) || FLAG_TOPIC_FORMAT.test( flagTopic );
      } );

      // allows 'de_DE', 'en-x-laxarJS' and such:
      validator.addFormat( 'language-tag', function( languageTag ) {
         return ( typeof languageTag !== 'string' ) || LANGUAGE_TAG_FORMAT.test( languageTag );
      } );

      // checks that object keys have the 'topic' format
      validator.addFormat( 'topic-map', function( topicMap ) {
         return ( typeof topicMap !== 'object' ) || Object.keys( topicMap ).every( function( topic ) {
            return TOPIC_FORMAT.test( topic );
         } );
      } );

      // checks that object keys have the 'language-tag' format
      validator.addFormat( 'localization', function( localization ) {
         return ( typeof localization !== 'object' ) || Object.keys( localization ).every( function( tag ) {
            return LANGUAGE_TAG_FORMAT.test( tag );
         } );
      } );

      return validator;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function createIdGeneratorForWidget( widgetId ) {
      var charCodeOfA = 'a'.charCodeAt( 0 );
      function fixLetter( l ) {
         // We map invalid characters deterministically to valid lower case letters. Thereby a collision of
         // two ids with different invalid characters at the same positions is less likely to occur.
         return String.fromCharCode( charCodeOfA + l.charCodeAt( 0 ) % 26 );
      }

      var prefix = ( 'widget__' + widgetId + '_' ).replace( INVALID_ID_MATCHER, fixLetter );
      return function( localId ) {
         return prefix + (''+localId).replace( INVALID_ID_MATCHER, fixLetter );
      };
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function createEventBusForWidget( eventBus, widgetSpecification, widgetConfiguration ) {
      var collaboratorId = 'widget.' + widgetSpecification.name + '#' + widgetConfiguration.id;
      var jsonPatchCompatible = (widgetSpecification.compatibility || []).indexOf( 'json-patch' ) !== -1;

      function forward( to ) {
         return function() {
            return eventBus[ to ].apply( eventBus, arguments );
         };
      }

      function augmentOptions( optionalOptions ) {
         return object.options( optionalOptions, { sender: collaboratorId } );
      }

      var subscriptions = [];

      return {
         addInspector: forward( 'addInspector' ),
         setErrorHandler: forward( 'setErrorHandler' ),
         setMediator: forward( 'setMediator' ),
         unsubscribe: function( subscriber ) {
            if( typeof subscriber.__compatibilitySubscriber === 'function' ) {
               eventBus.unsubscribe( subscriber.__compatibilitySubscriber );
               delete subscriber.__compatibilitySubscriber;
            }
            else {
               eventBus.unsubscribe( subscriber );
            }
         },
         subscribe: function( eventName, subscriber, optionalOptions ) {
            if( eventName.indexOf( 'didUpdate.' ) === 0 ) {
               subscriber = ensureJsonPatchCompatibility( jsonPatchCompatible, subscriber );
            }

            subscriptions.push( subscriber );

            var options = object.options( optionalOptions, { subscriber: collaboratorId } );

            return eventBus.subscribe( eventName, subscriber, options );
         },
         publish: function( eventName, optionalEvent, optionalOptions ) {
            if( eventName.indexOf( 'didUpdate.' ) === 0 && optionalEvent && 'data' in optionalEvent ) {
               log.develop(
                  'Widget "[0]" published didUpdate-event using deprecated attribute "data" (event: [1]).\n' +
                  '   Change this to "patches" immediately.',
                  collaboratorId,
                  eventName
               );
            }
            return eventBus.publish( eventName, optionalEvent, augmentOptions( optionalOptions ) );
         },
         publishAndGatherReplies: function( eventName, optionalEvent, optionalOptions ) {
            return eventBus.publishAndGatherReplies( eventName, optionalEvent, augmentOptions( optionalOptions ) );
         },
         subscriptions: subscriptions
      };
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function deriveFirstLevelDefaults( configuration, schema ) {
      Object.keys( schema.properties ).forEach( function( name ) {
         var propertySchema = schema.properties[ name ];
         var entry = configuration[ name ];

         if( 'properties' in propertySchema ) {
            Object.keys( propertySchema.properties ).forEach( function( secondLevelName ) {
               var secondLevelSchema = propertySchema.properties[ secondLevelName ];
               if( 'default' in secondLevelSchema && ( !entry || !( secondLevelName in entry ) ) ) {
                  object.setPath( configuration, name + '.' + secondLevelName, secondLevelSchema[ 'default' ] );
               }
            } );
         }
      } );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function ensureJsonPatchCompatibility( jsonPatchCompatible, subscriber ) {
      if( typeof subscriber.__compatibilitySubscriber === 'function' ) {
         return subscriber.__compatibilitySubscriber;
      }

      var compatibilitySubscriber = function( event, meta ) {
         if( !jsonPatchCompatible && 'patches' in event && !( 'updates' in event ) ) {
            event.updates = jsonPatchCompatibility.jsonPatchToUpdatesMap( event.patches );
         }
         else if( jsonPatchCompatible && !( 'patches' in event ) ) {
            event.patches = [];
            if( 'data' in event ) {
               event.patches.push( { op: 'replace', path: '', value: event.data } );
            }
            if( 'updates' in event ) {
               event.patches =
               event.patches.concat( jsonPatchCompatibility.updatesMapToJsonPatch( event.updates ) );
            }
         }
         return subscriber( event, meta );
      };
      subscriber.__compatibilitySubscriber = compatibilitySubscriber;
      return compatibilitySubscriber;
   }

   ////////////////////////////////////////////////////////////////////////////////////////////////////////

   return {
      create: create
   };

} );