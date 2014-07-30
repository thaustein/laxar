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
   module.run( [ '$compile', function( _$compile_, _$controller_ ) {
      $controller = _$controller_;
      $compile = _$compile_;
   } ] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function create( q, fileResourceProvider, eventBus, idGenerator ) {

      function createController( widgetPath, specification, features, widgetConfiguration, theme ) {

         var controllerName = 'widgets.' + widgetPath.replace( /\//g, '.' ) + '.Controller';

         var scope = ;
         var controller = $controller( controllerName, { '$scope': scope } );

      }

      function domPrepare() {

      }

      function domAttachTo( element ) {

      }

      function domDetach() {

      }

      return {
         createController: createController,
         domPrepare: domPrepare,
         domAttachTo: domAttachTo,
         domDetach: domDetach
      };
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return {
      create: create,
      module: module
   };

} );