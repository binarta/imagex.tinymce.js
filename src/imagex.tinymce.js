angular.module('imagex.tinymce', ['image-management', 'config', 'notifications', 'toggle.edit.mode'])
    .run(['$rootScope', '$window', 'imageManagement', 'config', 'ngRegisterTopicHandler', 'editModeRenderer', function ($rootScope, $window, imageManagement, config, ngRegisterTopicHandler, editModeRenderer) {
        ngRegisterTopicHandler({
            topic: 'tinymce.loaded',
            handler: addPlugin,
            executeHandlerOnce: true
        });

        function addPlugin() {
            $window.tinymce.PluginManager.add('binartax.img', function (editor) {

                const smallWidth = 100,
                    mediumWidth = 300,
                    largeWidth = 500,
                    maxWidth = 750;

                editor.addButton('binartax.img', {
                    icon: 'image',
                    tooltip: 'Insert/edit image',
                    onclick: open,
                    stateSelector: 'img:not([data-mce-object],[data-mce-placeholder])'
                });

                editor.addCommand('mceImage', open);

                function open() {
                    var scope = $rootScope.$new();
                    scope.image = {};
                    var dom = editor.dom;
                    var imgElm = editor.selection.getNode();
                    var file;
                    var popupPanelOpened = false;

                    imageManagement.fileUpload({
                        dataType: 'json',
                        add: function (e, d) {
                            scope.violations = imageManagement.validate(d);
                            if (scope.violations.length == 0) {
                                file = d;
                                if ($window.URL) {
                                    scope.previewImageUrl = $window.URL.createObjectURL(d.files[0]);
                                    var previewImg = new Image();
                                    previewImg.addEventListener('load', function() {
                                        scope.$apply(function () {
                                            scope.image['original-width'] = previewImg.width;
                                            setCalculatedAvailableSizes(previewImg.width);
                                            scope.image.width = previewImg.width > maxWidth ? maxWidth : previewImg.width;
                                        });
                                    });
                                    previewImg.src = scope.previewImageUrl;
                                } else {
                                    setCalculatedAvailableSizes(maxWidth);
                                    scope.image.width = maxWidth;
                                }
                            }
                            showPopupPanel();
                        }
                    });

                    if (imgElm.nodeName == 'IMG' && !imgElm.getAttribute('data-mce-object') && !imgElm.getAttribute('data-mce-placeholder')) {
                        scope.image = {
                            src: dom.getAttrib(imgElm, 'src'),
                            alt: dom.getAttrib(imgElm, 'alt'),
                            width: getCalculatedWidth(dom.getAttrib(imgElm, 'width')),
                            height: '',
                            'original-width': getCalculatedOriginalWidth(dom.getAttrib(imgElm, 'original-width'))
                        };
                        setCalculatedAvailableSizes(scope.image['original-width']);

                        scope.previewImageUrl = scope.image.src;
                        scope.showRemoveImageButton = true;
                        showPopupPanel();
                    } else {
                        scope.firstImage = true;
                        imageManagement.triggerFileUpload();
                    }

                    function getCalculatedWidth(width) {
                        if (isNaN(width)) return maxWidth;
                        if (width > maxWidth) return maxWidth;
                        return parseInt(width, 10);
                    }

                    function getCalculatedOriginalWidth(width) {
                        if (width == "") return maxWidth;
                        if(isNaN(width)) return maxWidth;
                        return parseInt(width, 10);
                    }

                    function setCalculatedAvailableSizes(originalWidth) {
                        scope.availableSizes = [];
                        if (originalWidth > smallWidth) scope.availableSizes.push({name: 'small', width: smallWidth});
                        if (originalWidth > mediumWidth) scope.availableSizes.push({name: 'medium', width: mediumWidth});
                        if (originalWidth > largeWidth) scope.availableSizes.push({name: 'large', width: largeWidth});
                        scope.availableSizes.push({name: 'original', width: originalWidth > maxWidth ? maxWidth : originalWidth});
                    }

                    scope.submit = function () {
                        if (file) {
                            var code = 'images/redacted/' + uuid.v4() + '.img';
                            scope.image.src = config.awsPath + code;

                            imageManagement.upload({file: file, code: code}).then(function () {
                                updateEditor();
                            }, function (reason) {
                                scope.violations.push('Upload failed: ' + reason);
                            }, function () {
                                scope.uploading = true;
                            }).finally(function () {
                                scope.uploading = false;
                            });
                        } else {
                            updateEditor();
                        }

                        function updateWidthParam() {
                            var src = scope.image.src;
                            var index = src.indexOf('?');
                            if (index > -1) src = src.slice(0, -src.slice(index).length);
                            src += '?width=' + scope.image.width;
                            scope.image.src = src;
                        }

                        function updateEditor() {
                            updateWidthParam();
                            editor.undoManager.transact(function () {
                                imgElm.nodeName == 'IMG' ? updateImgElm() : createNewImgElm();
                            });
                            editModeRenderer.close({id: 'popup'});
                        }

                        function createNewImgElm() {
                            scope.image.id = '__mcenew';
                            editor.focus();
                            editor.selection.setContent(dom.createHTML('img', scope.image));
                            imgElm = dom.get('__mcenew');
                            dom.setAttrib(imgElm, 'id', null);
                            waitLoad(imgElm);
                        }

                        function updateImgElm() {
                            dom.setAttribs(imgElm, scope.image);
                            waitLoad(imgElm);
                        }

                        function waitLoad(imgElm) {
                            function selectImage() {
                                imgElm.onload = imgElm.onerror = null;

                                if (editor.selection) {
                                    editor.selection.select(imgElm);
                                    editor.nodeChanged();
                                }
                            }
                            imgElm.onload = selectImage;
                            imgElm.onerror = selectImage;
                        }
                    };

                    scope.cancel = function () {
                        editModeRenderer.close({id: 'popup'});
                    };

                    scope.newImage = function () {
                        imageManagement.triggerFileUpload();
                    };

                    scope.remove = function () {
                        dom.remove(imgElm);
                        editor.focus();
                        editor.nodeChanged();
                        editModeRenderer.close({id: 'popup'});
                    };

                    function showPopupPanel() {
                        if(!popupPanelOpened) {
                            popupPanelOpened = true;
                            editModeRenderer.open({
                                id: 'popup',
                                template: '<form name="tinymceImageForm" id="tinymceImageForm" ng-submit="submit()">' +
                                '<h4 i18n code="i18n.menu.insert.image.title" read-only ng-bind="var"></h4>' +
                                '<hr>' +

                                '<div class="form-group" ng-if="violations.length > 0">' +
                                '<div ng-repeat="violation in violations">' +
                                '<span class="help-block text-danger" i18n code="upload.image.{{violation}}" read-only ng-bind="var"></span>' +
                                '</div>' +
                                '</div>' +

                                '<div class="form-group" ng-if="uploading">' +
                                '<strong class="help-block" i18n code="upload.image.uploading" read-only>' +
                                '<i class="fa fa-spinner fa-spin fa-fw"></i> <span ng-bind="var"></span></strong>' +
                                '</div>' +

                                '<div ng-hide="firstImage && violations.length > 0">' +

                                '<div class="bin-image-preview-wrapper" ng-if="previewImageUrl">' +
                                '<div class="bin-image-preview" ng-click="newImage()">' +
                                '<i class="fa fa-pencil fa-3x"></i>' +
                                '<img ng-src="{{previewImageUrl}}">' +
                                '</div>' +
                                '</div>' +

                                '<div class="form-group">' +
                                '<label for="tinymceImageFormAltField" i18n code="i18n.menu.image.alt.label" read-only ng-bind="var"></label>' +
                                '<input type="text" class="form-control" name="alt" id="tinymceImageFormAltField" ng-disabled="uploading" ng-model="image.alt">' +
                                '</div>' +

                                '<div class="form-group">' +
                                '<label for="tinymceImageFormSizeField" i18n code="i18n.menu.image.size.label" read-only ng-bind="var"></label>' +
                                '<select class="form-control" ng-disabled="uploading" ng-model="image.width">' +
                                '<option ng-repeat="size in availableSizes | orderBy: size.width" value="{{size.width}}" ' +
                                'ng-selected="{{size.width == image.width}}"' +
                                'i18n code="i18n.menu.image.size.{{size.name}}" read-only ng-bind="var"></option>' +
                                '</select>' +
                                '</div>' +

                                '</div>' +

                                '<div class=\"dropdown-menu-buttons\">' +
                                '<hr>' +
                                '<button type="button" class="btn btn-danger pull-left" ng-click="remove()" ng-disabled="uploading" ng-if="showRemoveImageButton" ' +
                                'i18n code="i18n.menu.remove.image.button" read-only ng-bind="var"></button>' +
                                '<button type="button" class="btn btn-success pull-left" ng-click="newImage()" ng-disabled="uploading" ng-if="!showRemoveImageButton" ' +
                                'i18n code="i18n.menu.new.image.button" read-only ng-bind="var"></button>' +
                                '<button type="submit" class="btn btn-primary" ng-disabled="uploading" i18n code="clerk.menu.ok.button" read-only ng-bind="var"></button>' +
                                '<button type="button" class="btn btn-default" ng-click="cancel()" ng-disabled="uploading" i18n code="clerk.menu.cancel.button" read-only ng-bind="var"></button>' +
                                '</div>' +
                                '</form>',
                                scope: scope
                            });
                        }
                    }
                }
            });
        }
    }]);