'use strict';

angular.module('depthyApp')
.directive('depthyViewer', function ($window, $timeout, $popover) {
  return {
    // template: '<canvas></canvas>',
    restrict: 'A',
    scope: true,
    /**
      imageSize (set)
      depthSize (set)
      stageSize (set)
    */
    controller: function($scope, $element, $attrs) {
      var viewer = $scope.viewer = $scope.$parent.$eval($attrs.depthyViewer),
          imageTexture, depthTexture, sprite, depthFilter,
          orientation = {},
          easedOffset = {x: 0, y: 0};

      _.defaults(viewer, {
        compoundSource: null,
        imageSource: null,
        depthSource: null,
        // set it when all sources are ready (they may be loaded earlier)
        ready: true,
        dirty: null,
        useCompoundImage: true,
        animate: false,
        animDuration: 1,
        animPosition: null,
        animScale: {x: 1, y: 1},
        depthScale: 1,
        offset: {x: 0, y: 0},
        easeFactor: Modernizr.mobile ? 0.2 : 0.9,
        update: 1,
      });

      $scope.stage = null;
      $scope.sizeDirty = 0;


      function setupStage(stage, renderer) {


        function resetStage() {
          if (sprite) {
            stage.removeChild(sprite);
            sprite = null;
            viewer.update = 1;
          }
        }

        function updateTexture(texture, url, sizeKey) {
          if (!texture || texture.baseTexture.imageUrl !== url) {
            // free up mem...
            if (texture) {
              PIXI.Texture.removeTextureFromCache(texture.baseTexture.imageUrl);
              texture = null;
            }
            viewer[sizeKey] = null;
            if (url) {
              texture = PIXI.Texture.fromImage(url);
              if (texture.baseTexture.hasLoaded) {
                viewer[sizeKey] = texture.frame;
                viewer.dirty++;
              } else {
                texture.addEventListener('update', function() {
                  viewer[sizeKey] = texture.frame;
                  viewer.dirty++;
                  $scope.$apply();
                });
              }
            }
          }
          return texture;
        }

        // watch image changes
        $scope.$watch('[viewer.dirty, viewer.useCompoundImage]', function() {

          imageTexture = updateTexture(imageTexture, viewer[viewer.useCompoundImage && viewer.compoundSource ? 'compoundSource' : 'imageSource'], 'imageSize');
          depthTexture = updateTexture(depthTexture, viewer.depthSource, 'depthSize');

        }, true);

        $scope.$watch('[viewer.imageSize, viewer.depthSize, viewer.ready, sizeDirty]', function() {
          if (!viewer.imageSize || !viewer.depthSize || !viewer.ready) return;

          var imageSize = viewer.imageSize,
              imageRatio = imageSize.width / imageSize.height,
              stageSize = {width: imageSize.width, height: imageSize.height};

          if (stageSize.height > $($window).height() * 0.8) {
            stageSize.height = Math.round($($window).height() * 0.8);
            stageSize.width = stageSize.height * imageRatio;
          }
          if (stageSize.width > $($window).width() * 0.8) {
            stageSize.width = Math.round($($window).width() * 0.8);
            stageSize.height = stageSize.width / imageRatio;
          }
          stageSize.width = Math.round(stageSize.width);
          stageSize.height = Math.round(stageSize.height);

          // retina
          if (window.devicePixelRatio >= 2) {
            stageSize.width *= 2;
            stageSize.height *= 2;
            $element.find('canvas')
              // .css('transform', 'scale(0.5, 0.5)')
              .css('width', stageSize.width / 2 + 'px')
              .css('height', stageSize.height / 2 + 'px');

          }

          viewer.stageSize = stageSize;
        }, true);

        $scope.$watch('[viewer.stageSize, viewer.dirty, viewer.ready]', function() {
          resetStage();

          viewer.loaded = !viewer.error && imageTexture && depthTexture && viewer.imageSize && viewer.depthSize && viewer.stageSize && viewer.ready;

          if (!viewer.loaded) return;

          var imageSize = viewer.imageSize,
            stageSize = viewer.stageSize;

          var stageScale = stageSize.width / imageSize.width;

          renderer.resize(stageSize.width, stageSize.height);

          sprite = new PIXI.Sprite(imageTexture);

          var depthScale = (Modernizr.mobile ? 0.015 : 0.015) * (viewer.depthScale || 1);
          depthFilter = new PIXI.DepthmapFilter(depthTexture);
          depthFilter.scale = {
            x: (stageSize.width > stageSize.height ? 1 : stageSize.height / stageSize.width) * depthScale,
            y: (stageSize.width < stageSize.height ? 1 : stageSize.width / stageSize.height) * depthScale
          };

          sprite.filters = [depthFilter];
          sprite.scale = new PIXI.Point(stageScale, stageScale);
          stage.addChild(sprite);
          //render on load events
          viewer.update = 1;
        }, true);

        $element.on('mousemove touchmove', function(e) {
          if (viewer.animate || angular.isNumber(viewer.animPosition)) return;

          var elOffset = $element.offset(),
              elWidth = $element.width(),
              elHeight = $element.height(),
              stageSize = viewer.stageSize.height * 0.8,
              pointerEvent = e.originalEvent.touches ? e.originalEvent.touches[0] : e,
              x = (pointerEvent.pageX - elOffset.left) / elWidth,
              y = (pointerEvent.pageY - elOffset.top) / elHeight;

          x = Math.max(-1, Math.min(1, (x * 2 - 1) * elWidth / stageSize));
          y = Math.max(-1, Math.min(1, (y * 2 - 1) * elHeight / stageSize));

          if (depthFilter) {
            viewer.offset = {x: -x, y: -y};
            viewer.update = 1;
          }
          
        });

        $window.addEventListener('deviceorientation', function(event) {
          if (event.beta === null || event.gamma === null) return;
          if (viewer.animate || angular.isNumber(viewer.animPosition)) return;

          if (orientation) {
            var portrait = window.innerHeight > window.innerWidth,
                beta = (event.beta - orientation.beta) * 0.2,
                gamma = (event.gamma - orientation.gamma) * 0.2,
                x = portrait ? -gamma : -beta,
                y = portrait ? -beta : -gamma;

            if (x && y) {
              viewer.offset = {
                x : Math.max(-1, Math.min(1, viewer.offset.x + x)),
                y : Math.max(-1, Math.min(1, viewer.offset.y + y))
              };
            }
            // console.log("offset %d %d ABG %d %d %d", viewer.offset.x, viewer.offset.y, event.alpha, event.beta, event.gamma)
            viewer.update = 1;

          }
          orientation = {
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma
          };
        });

        $window.addEventListener('resize', function() {
          $scope.sizeDirty ++;
          $scope.$apply();
        });

      }


      var stageReady = false;
      $scope.pixiAnimate = function(stage, renderer) {
        if (!stageReady) {
          setupStage(stage, renderer);
          stageReady = true;
          $scope.$apply();
          return;
        }

        if (viewer.offset.x !== easedOffset.x || viewer.offset.y !== easedOffset.y) {
          
          if (viewer.easeFactor && !angular.isNumber(viewer.animPosition)) {
            easedOffset.x = easedOffset.x * viewer.easeFactor + viewer.offset.x * (1-viewer.easeFactor);
            easedOffset.y = easedOffset.y * viewer.easeFactor + viewer.offset.y * (1-viewer.easeFactor);
            if (Math.abs(easedOffset.x - viewer.offset.x) < 0.0001 && Math.abs(easedOffset.y - viewer.offset.y) < 0.0001) {
              easedOffset = viewer.offset;
            }
          } else {
            easedOffset = viewer.offset;
          }

          depthFilter.offset = {
            x : easedOffset.x,
            y : easedOffset.y
          };
          viewer.update = 1;
        }

        if (viewer.animate || angular.isNumber(viewer.animPosition)) {
          var now = angular.isNumber(viewer.animPosition) ?
                      viewer.animPosition * 1000 
                      : (Modernizr.performance ? window.performance.now() : new Date().getTime());
          depthFilter.offset = {
            x : Math.sin(now * Math.PI / viewer.animDuration / 1000) * viewer.animScale.x,
            y : Math.cos(now * Math.PI / viewer.animDuration / 1000) * viewer.animScale.y
          };
          viewer.update = 1;
        }


        if (!viewer.update) {
          return false;
        }

        viewer.update--;
      };


      // $scope.$on('popover.show', function() {
      //   console.log('gif popover');
      // });

      // $scope.gifExportSetup = function(event) {
      //   var popover = $popover($(event.currentTarget), {
      //     placement: 'top',
      //     trigger: 'manual',
      //     title: 'How do you want your GIF?',
      //     contentTemplate: "views/gif-popover.html",
      //   })
      //   popover.$promise.then(function() {popover.show()})
      // }

    },
    link: function postLink() {

    }
  };

});