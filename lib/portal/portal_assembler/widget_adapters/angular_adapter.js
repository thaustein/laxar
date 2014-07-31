/**
 * Copyright 2014 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
define( [
   'angular',
   'require',
   '../../../utilities/assert',
   '../../../utilities/path',
   '../../paths'
], function( ng, require, assert, path, paths ) {
   'use strict';

   var module = ng.module( 'laxar.portal.angular_adapter', [] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   var $compile;
   var $controller;
   var themeManager;
   module.run( [
      '$compile', '$controller', 'ThemeManager',
      function( _$compile_, _$controller_, _themeManager_ ) {
         $controller = _$controller_;
         $compile = _$compile_;
         themeManager = _themeManager_;
      }
   ] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function create( q, fileResourceProvider, specification, features, widgetConfiguration ) {

      var element_;
      var scope_;
      var hasDom_ = false;

      function createController( eventBus, idGenerator, configuration ) {
         var controllerName = 'widgets.' + widgetConfiguration.widget.replace( /\//g, '.' ) + '.Controller';

         scope_ = configuration.anchorScope.$new();
         scope_.eventBus = eventBus;
         scope_.id = idGenerator;
         scope_.features = features;

         $controller( controllerName, { '$scope': scope_ } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function domPrepare( element ) {
         element_ = ng.element( element );
         return resolveAssets( q, widgetConfiguration, specification )
            .then( function( urls ) {
               if( urls.templateUrl ) {
                  hasDom_ = true;
                  return fileResourceProvider.provide( urls.templateUrl )
                     .then( function( templateHtml ) {
                        element_.html( templateHtml );
                        $compile( element_ )( scope_ );
                     } );
               }
            } );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function domAttachTo( anchorElement ) {
         if( !hasDom_ ) {
            return;
         }

         ng.element( anchorElement ).append( element_ );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function domDetach() {
         if( !hasDom_ ) {
            return;
         }

         element_[0].parentNode.removeChild( element_[0] );
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function widgetId() {
         return widgetConfiguration.id;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function destroy() {
         scope_.$destroy();
         scope_.eventBus.subscriptions.forEach( function( subscriber ) {
            scope_.eventBus.unsubscribe( subscriber );
         } );
         delete scope_.eventBus.subscriptions;
      }

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      return {
         createController: createController,
         domPrepare: domPrepare,
         domAttachTo: domAttachTo,
         domDetach: domDetach,
         widgetId: widgetId,
         destroy: destroy
      };
   }

   function resolveAssets( q, widgetConfiguration, widgetSpecification ) {
      var technicalName = widgetConfiguration.widget.split( '/' ).pop();
      var widgetPath = path.join( paths.WIDGETS, widgetConfiguration.widget );
      var htmlFile = technicalName + '.html';
      var cssFile = path.join( 'css/', technicalName + '.css' );

      var promises = [];
      promises.push( themeManager.urlProvider(
         path.join( paths.THEMES, '[theme]', 'widgets', widgetConfiguration.widget ),
         path.join( widgetPath, '[theme]' )
      ).provide( [ htmlFile, cssFile ] ) );

      promises = promises.concat( ( widgetSpecification.controls || [] ).map( function( controlReference ) {
         var name = controlReference.split( '/' ).pop();
         return themeManager.urlProvider(
            path.join( paths.THEMES, '[theme]', controlReference ),
            path.join( require.toUrl( controlReference ), '[theme]' )
         ).provide( [ path.join( 'css/', name + '.css' ) ] );
      } ) );

      return q.all( promises )
         .then( function( results ) {
            var widgetUrls = results[ 0 ];
            var cssUrls = results.slice( 1 )
               .map( function( urls ) { return urls[ 0 ]; } )
               .concat( widgetUrls.slice( 1 ) )
               .filter( function( url ) { return !!url; } );

            return {
               templateUrl: widgetUrls[0] || '',
               cssFileUrls: cssUrls
            };
         } )
         ;
   }


   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return {
      create: create,
      module: module
   };

} );