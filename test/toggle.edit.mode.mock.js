angular.module('toggle.edit.mode', [])
    .service('editModeRenderer', function () {
        var self = this;

        this.open = function (ctx) {
            self.openSpy = ctx;
        };

        this.close = jasmine.createSpy('close');
    });