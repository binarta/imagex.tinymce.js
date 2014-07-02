angular.module('imagex.tinymce', [])
    .run(function($rootScope, $controller) {
        tinymce.PluginManager.add('binartax.img', function (editor, url) {
            editor.addButton('binartax.img', {
                icon: 'mce-ico mce-i-image',
                tooltip: 'Insert/edit image',
                onclick: function () {
                    var ctrl = $controller('ImageUploadDialogController', {$scope: $rootScope.$new()});
                    if (editor.selection.getNode().src) ctrl.source(editor.selection.getNode().src);
                    ctrl.open({
                        accept: function (src) {
                            editor.insertContent('<img src="' + src + '"/>');
                        }
                    });
                }
            })
        });
    });