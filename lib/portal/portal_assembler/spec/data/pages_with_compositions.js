/**
 * Copyright 2014 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
define( {

   pageWithSimpleComposition: {
      areas: {
         area1: [
            { widget: 'someWidgetPath1', id: 'id1' },
            { composition: 'simpleComposition' },
            { widget: 'someWidgetPath1', id: 'id2' }
         ],
         area2: [
            { widget: 'someWidgetPath1', id: 'id3' }
         ]
      }
   },

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   pageWithCompositionWithAdditionalAreas: {
      areas: {
         area1: [
            { composition: 'compositionWithAdditionalAreas' }
         ],
         area2: [
            { widget: 'someWidgetPath1', id: 'id3' }
         ]
      }
   },

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   pageWithCompositionWithFeaturesOverwritingDefaults: {
      areas: {
         area1: [
            {
               composition: 'compositionWithFeaturesDefined',
               features: {
                  close: {
                     onActions: [ 'close', 'cancelAction' ]
                  },
                  something: {
                     resource: 'cars'
                  }
               }
            }
         ]
      }
   },

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   pageWithCompositionWithFeaturesOmittingDefaults: {
      areas: {
         area1: [
            {
               composition: 'compositionWithFeaturesDefined',
               features: {
                  close: {
                     onActions: [ 'close', 'cancelAction' ]
                  }
               }
            }
         ]
      }
   },

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   pageWithCompositionWithEmbeddedComposition: {
      areas: {
         area1: [
            {
               composition: 'compositionWithEmbeddedComposition',
               features: {
                  shutdown: {
                     onActions: [ 'shutdownAction' ]
                  }
               }
            }
         ]
      }
   },

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   pageWithCompositionWithMergedFeatures: {
      areas: {
         area1: [
            {
               composition: 'compositionWithMergedFeatures',
               id: 'myComposition',
               features: {
                  closeButton: {
                     action: 'closeIt'
                  },
                  close: {
                     onActions: [ 'closeAgain', 'needMoreCloseActions' ]
                  }
               }
            }
         ]
      }
   },

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   pageWithCompositionWithDirectCycle: {
      areas: {
         area1: [
            { composition: 'compositionWithDirectCycle' }
         ]
      }
   },

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   pageWithCompositionWithCycle: {
      areas: {
         area1: [
            { composition: 'compositionWithCycle' }
         ]
      }
   },

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   pageWithCompositionInSubFolder: {
      areas: {
         area1: [
            { composition: 'composition/in/subfolder' }
         ]
      }
   }

} );