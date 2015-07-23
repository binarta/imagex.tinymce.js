angular.module('notifications', [])
    .factory('ngRegisterTopicHandler', function() {
        return jasmine.createSpy('ngRegisterTopicHandler');
    })
    .factory('topicMessageDispatcher', function () {
        return jasmine.createSpy('topicMessageDispatcher');
    });