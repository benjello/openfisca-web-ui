define([
  'jquery',
  'underscore',
  'persona'
], function($, _) {
  'use strict';

  function init (authconfig) {
    navigator.id.watch({
      loggedInUser: authconfig.currentUser,
      onlogin: function (assertion) {
        $.ajax({
          type: 'POST',
          url: '/login',
          data: {
            assertion: assertion
          }
        })
        .done(function() {
          window.location.reload();
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
          console.error('onlogin fail', jqXHR, textStatus, errorThrown, jqXHR.responseText);
          navigator.id.logout();
          // TODO translate string
          alert('Login failure');
        });
      },
      onlogout: function () {
        // TODO use urls.get_url.
        if (window.location.pathname == '/logout') {
          window.location.href = '/';
        } else {
          $.ajax({
            type: 'POST',
            url: '/logout'
          })
          .done(function() {
            if (_.isUndefined(authconfig.redirectLocation)) {
              window.location.reload();
            } else {
              window.location.href = authconfig.redirectLocation;
            }
          })
          .fail(function(jqXHR, textStatus, errorThrown) {
            console.error('onlogout fail', jqXHR, textStatus, errorThrown, jqXHR.responseText);
            // TODO translate string
            alert('Logout failure');
          });
        }
      }
    });
    if (authconfig.logout) {
      navigator.id.logout();
    } else {
      $(document).on('click', '.sign-in', function () {
        navigator.id.request();
      });
      $(document).on('click', '.sign-out', function() {
        navigator.id.logout();
      });
    }
  }

  return {init: init};

});