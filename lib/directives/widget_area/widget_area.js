/**
 * Copyright 2014 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
define( [
   'angular'
], function( ng ) {
   'use strict';

   var module = ng.module( 'laxar.directives.widget_area', [] );

   var DIRECTIVE_NAME = 'axWidgetArea';

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   module.directive( DIRECTIVE_NAME, [ '$compile', 'portal.PageService', function( $compile, pageService ) {
      return {
         restrict: 'A',
         scope: true,
         link: function( scope, element, attrs ) {

            var areaName = attrs[ DIRECTIVE_NAME ];
            if( !areaName ) {
               if( attrs[ DIRECTIVE_NAME + 'Binding' ] ) {
                  areaName = scope.$eval( attrs[ DIRECTIVE_NAME + 'Binding' ] );
               }
               else {
                  throw new Error( 'A widget area either needs a static name assigned ' +
                                   'or a binding via "data-ax-widget-area-binding".');
               }
            }

            if( scope.widget && scope.widget.id ) {
               // If a widget is found in a parent scope, this area must be an area contained in another
               // widget. Therefore the areaName is prefixed with the id of that widget.
               areaName = scope.widget.id + '.' + areaName;
            }

            var deregister = pageService.controllerForScope( scope ).areas.register( areaName, element[ 0 ] );
            scope.$on( '$destroy', deregister );
         }
      };
   } ] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return module;

} );