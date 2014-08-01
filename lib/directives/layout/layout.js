/**
 * Copyright 2014 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
define( [
   'angular',
   '../../logging/log'
], function( ng, log ) {
   'use strict';

   var module = ng.module( 'laxar.directives.layout', [] );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   var directiveName = 'axLayout';
   var directive = [ 'LayoutLoader', '$compile', function( layoutLoader, $compile ) {

      return {
         restrict: 'A',
         template: '<div></div>',
         replace: true,
         link: function( scope, element, attrs ) {
            var layoutName = scope.$eval( attrs[ directiveName ] );
            layoutLoader.load( layoutName )
               .then( function( layoutInfo ) {
                  element.html( layoutInfo.htmlContent );
                  element.addClass( layoutInfo.className );
                  $compile( element.contents() )( scope );
               }, function( err ) {
                  log.error( 'axLayout: could not load layout [0], error: [1]', layoutName, err );
               } );
         }
      };

   } ];

   module.directive( directiveName, directive );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return module;

} );
