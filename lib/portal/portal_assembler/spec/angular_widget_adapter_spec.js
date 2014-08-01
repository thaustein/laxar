/**
 * Copyright 2014 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
define( [
   '../widget_adapters/angular_adapter',
   '../../../testing/portal_mocks'
], function( angularWidgetAdapterModule, portalMocks ) {
   'use strict';

   describe( 'An angular widget adapter module', function() {

      it( 'provides an AngularJS module representation', function() {
         expect( angularWidgetAdapterModule.module ).toBeDefined();
         expect( angularWidgetAdapterModule.module.name ).toBeDefined();
      } );

      it( 'allows to create an adapter from dependencies', function() {
         expect( angularWidgetAdapterModule.create ).toBeDefined();
         expect( angularWidgetAdapterModule.create ).toEqual( jasmine.any( Function ) );
         var adapter;
         expect( function() {
            adapter = angularWidgetAdapterModule.create();
         } ).not.toThrow();
         expect( adapter ).toBeDefined();
         expect( adapter.createController ).toBeDefined();
      } );

   } );


   describe( 'An angular widget adapter', function() {

      // NEEDS FIX A: to be completed

   } );

} );