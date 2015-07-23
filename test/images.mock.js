angular.module('image-management',[])
    .factory('imageManagement', function () {
        return jasmine.createSpyObj('imageManagement', ['fileUpload', 'validate', 'triggerFileUpload', 'upload']);
    });