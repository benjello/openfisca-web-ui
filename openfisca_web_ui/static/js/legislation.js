'use strict';

var $ = require('jquery');


function init(config) {
  // X-editable is loaded in the DOM.

  //turn to inline mode
  $.fn.editable.defaults.mode = 'inline';

  // editable
  $('.editable').editable({
    type: 'text',
    url: config.legislationEditUrl,
    pk: 1,
    title: 'Nouvelle valeur',
  });

  $('.collapse-node-toggle').on('click', function(evt) {
    evt.preventDefault();
  });

  $('.btn-expand-all').on('click', function() {
    $('.collapse-node-toggle.collapsed').removeClass('collapsed');
    $('.collapse-node.collapse').addClass('in').removeClass('collapse').css({height: ''});
  });

  $('.btn-collapse-all').on('click', function() {
    $('.collapse-node-toggle').addClass('collapsed');
    $('.collapse-node').addClass('collapse').removeClass('in');
  });

  $('.period-select').on('change', function() {
    $(this).parent().next().find('li a').eq($(this).val()).tab('show');
  });
}

module.exports = {init: init};
