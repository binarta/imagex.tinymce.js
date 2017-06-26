describe('imagex.tinymce', function () {

    beforeEach(module('imagex.tinymce'));

    const smallWidth = 100,
        mediumWidth = 300,
        largeWidth = 500,
        maxWidth = 1920;

    var registry, $window, tinymcePluginName, editorSpy, imageManagement, editModeRenderer, config, scope;
    var imgElm = {};
    var _file = {
        size: 2000,
        type: 'image/jpeg',
        name: 'name'
    };
    var validFile = {
        files: [_file]
    };

    uuid = {
        v4: function () {
            return '123456';
        }
    };

    beforeEach(inject(function (ngRegisterTopicHandler, _$window_, _imageManagement_, _editModeRenderer_, _config_) {
        registry = ngRegisterTopicHandler;
        $window = _$window_;
        imageManagement = _imageManagement_;
        editModeRenderer = _editModeRenderer_;
        config = _config_;
        config.awsPath = 'aws/path/';

        editorSpy = {
            selection: {
                getNode: function () {
                    return imgElm;
                }
            },
            dom: {
                getAttribValue: [],
                getAttrib: function (el, name) {
                    this.getAttribSpy = {
                        el: el,
                        name: name
                    };
                    return this.getAttribValue[name] || name;
                },
                remove: function (el) {
                    this.removeSpy = el;
                }
            },
            addButton: function (name, button) {
                this.addButtonSpy = {
                    name: name,
                    button: button
                };
            },
            addCommand : function (name, command) {
                this.addCommandSpy = {
                    name: name,
                    command: command
                }
            },
            focus: function () {
                this.focusSpy = true;
            },
            nodeChanged: function () {
                this.nodeChangedSpy = true;
            },
            undoManager: {
                transact: function () {}
            }
        };

        $window.tinymce = {
            PluginManager: {
                add: function (name, fn) {
                    tinymcePluginName = name;
                    fn(editorSpy);
                }
            }
        };
        $window.URL = undefined;
    }));

    it('register on tinymce.loaded notification', function () {
        expect(registry).toHaveBeenCalledWith({
            topic: 'tinymce.loaded',
            handler: jasmine.any(Function),
            executeHandlerOnce: true
        });
    });

    describe('when tinymce is loaded', function () {
        beforeEach(function () {
            registry.calls.first().args[0].handler();
        });

        it('add plugin to tinymce plugin-manager', function () {
            expect(tinymcePluginName).toEqual('binartax.img');
        });

        it('add button to editor', function () {
            expect(editorSpy.addButtonSpy).toEqual({
                name: 'binartax.img',
                button: {
                    icon: 'image',
                    tooltip: 'Insert/edit image',
                    onclick: jasmine.any(Function),
                    stateSelector: 'img:not([data-mce-object],[data-mce-placeholder])'
                }
            });
        });

        it('add command to editor', function () {
            expect(editorSpy.addCommandSpy).toEqual({
                name: 'mceImage',
                command: jasmine.any(Function)
            });
        });

        describe('when adding new image', function () {
            beforeEach(function () {
                editorSpy.addButtonSpy.button.onclick();
            });

            it('file upload is set up', function () {
                expect(imageManagement.fileUpload).toHaveBeenCalledWith({
                    dataType: 'json',
                    add: jasmine.any(Function)
                });
            });

            it('file upload has been triggered', function () {
                expect(imageManagement.triggerFileUpload).toHaveBeenCalled();
            });

            describe('with valid file', function () {
                beforeEach(function () {
                    imageManagement.validate.and.returnValue([]);
                    imageManagement.fileUpload.calls.first().args[0].add(null, validFile);
                });

                it('file validation has been triggered', function () {
                    expect(imageManagement.validate).toHaveBeenCalledWith(validFile);
                });

                it('edit mode popup panel is opened', function () {
                    expect(editModeRenderer.openSpy).toEqual({
                        id: 'popup',
                        template: jasmine.any(String),
                        scope: jasmine.any(Object)
                    });
                });

                describe('with edit mode popup panel scope', function () {
                    beforeEach(function () {
                        scope = editModeRenderer.openSpy.scope;
                    });

                    it('enable firstImage flag on scope', function () {
                        expect(scope.firstImage).toBeTruthy();
                    });

                    it('set available sizes on scope', function () {
                        expect(scope.availableSizes).toEqual([
                            {name: 'small', width: smallWidth},
                            {name: 'medium', width: mediumWidth},
                            {name: 'large', width: largeWidth},
                            {name: 'original', width: maxWidth}
                        ]);
                    });

                    it('set initial size on original size', function () {
                        expect(scope.image.width).toEqual(maxWidth);
                    });

                    it('on cancel close panel', function () {
                        scope.cancel();

                        expect(editModeRenderer.close).toHaveBeenCalledWith({id: 'popup'});
                    });

                    describe('on submit', function () {
                        var onUploadSuccess;

                        beforeEach(function () {
                            imageManagement.upload.and.returnValue({
                                then: function (callback) {
                                    onUploadSuccess = callback;
                                    return {
                                        finally: function () {

                                        }
                                    };
                                }
                            });

                            scope.submit();
                        });

                        it('file upload is triggered', function () {
                            expect(imageManagement.upload).toHaveBeenCalledWith({
                                file: validFile,
                                code: 'images/redacted/123456.img'
                            });
                        });

                        describe('on upload success', function () {
                            beforeEach(function () {
                                onUploadSuccess();
                            });

                            it('width is added to src', function () {
                                expect(scope.image.src).toEqual('aws/path/images/redacted/123456.img?width=' + maxWidth);
                            });

                            it('panel is closed', function () {
                                expect(editModeRenderer.close).toHaveBeenCalledWith({id: 'popup'});
                            });
                        });
                    });
                });
            });

            describe('with invalid file', function () {
                beforeEach(function () {
                    imageManagement.validate.and.returnValue(['violation']);
                    imageManagement.fileUpload.calls.first().args[0].add(null, 'invalid');
                    scope = editModeRenderer.openSpy.scope;
                });

                it('file validation has been triggered', function () {
                    expect(imageManagement.validate).toHaveBeenCalledWith('invalid');
                });

                it('violations are on scope', function () {
                    expect(scope.violations).toEqual(['violation']);
                });
            });
        });

        describe('when previous image selected', function () {
            describe('and selected image is valid', function () {
                beforeEach(function () {
                    imgElm = {
                        nodeName: 'IMG',
                        getAttribute: function (selector) {
                            if (selector == 'data-mce-object' || selector == 'data-mce-placeholder') return false;
                        }
                    };
                });

                [
                    {actual: "100%", expected: maxWidth},
                    {actual: "30px", expected: maxWidth},
                    {actual: "10000", expected: maxWidth},
                    {actual: "700", expected: 700},
                    {actual: "501", expected: 501},
                    {actual: "500", expected: 500},
                    {actual: "499", expected: 499},
                    {actual: "300", expected: 300},
                    {actual: "299", expected: 299},
                    {actual: "101", expected: 101},
                    {actual: "100", expected: 100},
                    {actual: "10", expected: 10}
                ].forEach(function (test) {
                        describe('with a width of ' + test.actual, function () {
                            beforeEach(function () {
                                editorSpy.dom.getAttribValue['width'] = test.actual;

                                editorSpy.addButtonSpy.button.onclick();
                                scope = editModeRenderer.openSpy.scope;
                            });

                            it('set initial size on original size', function () {
                                expect(scope.image.width).toEqual(test.expected);
                            });
                        });
                    });

                describe('and original-width is set', function () {
                    beforeEach(function () {
                        editorSpy.dom.getAttribValue['original-width'] = 10000;

                        editorSpy.addButtonSpy.button.onclick();
                    });

                    it('edit mode popup panel is opened', function () {
                        expect(editModeRenderer.openSpy).toEqual({
                            id: 'popup',
                            template: jasmine.any(String),
                            scope: jasmine.any(Object)
                        });
                    });

                    describe('with edit mode popup panel scope', function () {
                        beforeEach(function () {
                            scope = editModeRenderer.openSpy.scope;
                        });

                        it('image is on scope', function () {
                            expect(scope.image).toEqual({
                                src: 'src',
                                alt: 'alt',
                                width: maxWidth,
                                height: '',
                                'original-width': 10000
                            });
                        });

                        it('set available sizes on scope', function () {
                            expect(scope.availableSizes).toEqual([
                                {name: 'small', width: smallWidth},
                                {name: 'medium', width: mediumWidth},
                                {name: 'large', width: largeWidth},
                                {name: 'original', width: maxWidth}
                            ]);
                        });

                        it('preview url is on scope', function () {
                            expect(scope.previewImageUrl).toEqual(scope.image.src);
                        });

                        it('show remove image button', function () {
                            expect(scope.showRemoveImageButton).toBeTruthy();
                        });

                        describe('on remove', function () {
                            beforeEach(function () {
                                scope.remove();
                            });

                            it('image is removed', function () {
                                expect(editorSpy.dom.removeSpy).toEqual(imgElm);
                                expect(editorSpy.focusSpy).toBeTruthy();
                                expect(editorSpy.nodeChangedSpy).toBeTruthy();
                            });

                            it('panel is closed', function () {
                                expect(editModeRenderer.close).toHaveBeenCalledWith({id: 'popup'});
                            });
                        });

                        describe('on new image', function () {
                            beforeEach(function () {
                                scope.newImage();
                            });

                            it('trigger new file upload', function () {
                                expect(imageManagement.triggerFileUpload).toHaveBeenCalled();
                            });
                        });
                    });
                });

                describe('and original-width is less than 750', function () {
                    beforeEach(function () {
                        editorSpy.dom.getAttribValue['original-width'] = 600;

                        editorSpy.addButtonSpy.button.onclick();
                        scope = editModeRenderer.openSpy.scope;
                    });

                    it('image is on scope', function () {
                        expect(scope.image).toEqual({
                            src: 'src',
                            alt: 'alt',
                            width: maxWidth,
                            height: '',
                            'original-width': 600
                        });
                    });

                    it('set available sizes on scope', function () {
                        expect(scope.availableSizes).toEqual([
                            {name: 'small', width: smallWidth},
                            {name: 'medium', width: mediumWidth},
                            {name: 'large', width: largeWidth},
                            {name: 'original', width: 600}
                        ]);
                    });
                });
            });

            describe('and selected image is invalid', function () {
                beforeEach(function () {
                    imgElm = {
                        nodeName: 'IMG',
                        getAttribute: function (selector) {
                            if (selector == 'data-mce-object' || selector == 'data-mce-placeholder') return true;
                        }
                    };

                    editorSpy.addButtonSpy.button.onclick();
                });

                it('file upload has been triggered', function () {
                    expect(imageManagement.triggerFileUpload).toHaveBeenCalled();
                });
            });
        });

        describe('when browser support window.URL', function () {
            var mockImageListener, mockImageSize;

            beforeEach(function () {
                $window.Image = function () {
                    return {
                        width: mockImageSize,
                        addEventListener: function (event, listener) {
                            mockImageListener = listener;
                        }
                    }
                };

                $window.URL = {
                    createObjectURL: function (img) {
                        this.createObjectURLSpy = img;
                        return 'image.img';
                    }
                }
            });

            describe('when adding new image', function () {
                beforeEach(function () {
                    editorSpy.addButtonSpy.button.onclick();
                });

                function execute() {
                    imageManagement.validate.and.returnValue([]);
                    imageManagement.fileUpload.calls.first().args[0].add(null, validFile);
                    scope = editModeRenderer.openSpy.scope;
                    mockImageListener();
                }

                [
                    {
                        imageSize: 1930,
                        expected: [
                            {name: 'small', width: smallWidth},
                            {name: 'medium', width: mediumWidth},
                            {name: 'large', width: largeWidth},
                            {name: 'original', width: maxWidth}
                        ]
                    },
                    {
                        imageSize: 1920,
                        expected: [
                            {name: 'small', width: smallWidth},
                            {name: 'medium', width: mediumWidth},
                            {name: 'large', width: largeWidth},
                            {name: 'original', width: maxWidth}
                        ]
                    },
                    {
                        imageSize: 1919,
                        expected: [
                            {name: 'small', width: smallWidth},
                            {name: 'medium', width: mediumWidth},
                            {name: 'large', width: largeWidth},
                            {name: 'original', width: 1919}
                        ]
                    },
                    {
                        imageSize: 750,
                        expected: [
                            {name: 'small', width: smallWidth},
                            {name: 'medium', width: mediumWidth},
                            {name: 'large', width: largeWidth},
                            {name: 'original', width: 750}
                        ]
                    },
                    {
                        imageSize: 500,
                        expected: [
                            {name: 'small', width: smallWidth},
                            {name: 'medium', width: mediumWidth},
                            {name: 'original', width: 500}
                        ]
                    },
                    {
                        imageSize: 499,
                        expected: [
                            {name: 'small', width: smallWidth},
                            {name: 'medium', width: mediumWidth},
                            {name: 'original', width: 499}
                        ]
                    },
                    {
                        imageSize: 300,
                        expected: [
                            {name: 'small', width: smallWidth},
                            {name: 'original', width: 300}
                        ]
                    },
                    {
                        imageSize: 280,
                        expected: [
                            {name: 'small', width: smallWidth},
                            {name: 'original', width: 280}
                        ]
                    },
                    {
                        imageSize: 100,
                        expected: [
                            {name: 'original', width: 100}
                        ]
                    },
                    {
                        imageSize: 10,
                        expected: [
                            {name: 'original', width: 10}
                        ]
                    }
                ].forEach(function (test) {
                        describe('with image size equal to ' + test.imageSize, function () {
                            beforeEach(function () {
                                mockImageSize = test.imageSize;
                                execute();
                            });

                            it('preview url is on scope', function () {
                                expect($window.URL.createObjectURLSpy).toEqual(_file);
                                expect(scope.previewImageUrl).toEqual('image.img');
                            });

                            it('set original width on image obj', function () {
                                expect(scope.image['original-width']).toEqual(test.imageSize);
                            });

                            it('set available sizes on scope', function () {
                                expect(scope.availableSizes).toEqual(test.expected);
                            });

                            it('set initial size on original size', function () {
                                var originalWidth;
                                test.expected.forEach(function (value) {
                                    if (value.name == 'original') originalWidth = value.width;
                                });

                                expect(scope.image.width).toEqual(originalWidth);
                            });
                        });
                    });
            });

            describe('when previous image selected', function () {

            });
        });
    });
});