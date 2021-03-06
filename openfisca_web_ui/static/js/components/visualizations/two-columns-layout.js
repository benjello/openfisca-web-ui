/** @jsx React.DOM */
'use strict';


var React = require('react');


var TwoColumnsLayout = React.createClass({
  propTypes: {
    children: React.PropTypes.arrayOf(React.PropTypes.component).isRequired,
    leftComponentRef: React.PropTypes.string,
    leftWidth: React.PropTypes.number.isRequired,
    rightComponentRef: React.PropTypes.string,
    rightWidth: React.PropTypes.number.isRequired,
  },
  findChildComponent: function(ref) {
    return this.props.children.find(child => child.props.ref === ref);
  },
  getDefaultProps: function() {
    return {
      leftWidth: 7,
      rightWidth: 5,
    };
  },
  render: function() {
    return ! this.props.leftComponentRef || ! this.props.rightComponentRef ?
      this.renderOneColumn(this.props.leftComponentRef || this.props.rightComponentRef) :
      this.renderTwoColumns();
  },
  renderOneColumn: function(ref) {
    return this.findChildComponent(ref);
  },
  renderTwoColumns: function() {
    var leftComponent = this.findChildComponent(this.props.leftComponentRef),
      rightComponent = this.findChildComponent(this.props.rightComponentRef);
    return (
      <div className='row'>
        <div className={`col-sm-${this.props.leftWidth}`}>
          {leftComponent}
        </div>
        <div className={`col-sm-${this.props.rightWidth}`}>
          {rightComponent}
        </div>
      </div>
    );
  },
});


module.exports = TwoColumnsLayout;
