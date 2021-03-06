/** @jsx React.DOM */
'use strict';

var Lazy = require('lazy.js'),
  React = require('react/addons');

var Tooltip = require('../tooltip');

var cx = React.addons.classSet;


var VariablesTree = React.createClass({
  propTypes: {
    activeVariableCode: React.PropTypes.string,
    displayVariablesColors: React.PropTypes.bool,
    expandedSubtotalColor: React.PropTypes.string.isRequired,
    formatNumber: React.PropTypes.func.isRequired,
    negativeColor: React.PropTypes.string.isRequired,
    noColorFill: React.PropTypes.string.isRequired,
    onVariableHover: React.PropTypes.func,
    onVariableToggle: React.PropTypes.func,
    positiveColor: React.PropTypes.string.isRequired,
    variables: React.PropTypes.array.isRequired,
  },
  getDefaultProps: function() {
    return {
      expandedSubtotalColor: 'lightGray',
      negativeColor: 'red',
      noColorFill: 'gray',
      positiveColor: 'green',
    };
  },
  getInitialState: function() {
    return {
      hoveredVariableCode: null,
    };
  },
  handleVariableHover: function(variable) {
    this.setState({hoveredVariableCode: variable ? variable.code : null});
    this.props.onVariableHover && this.props.onVariableHover(variable);
  },
  render: function() {
    var variablesSequence = Lazy(this.props.variables);
    var variables = variablesSequence.initial().reverse().concat(variablesSequence.last()).toArray();
    var activeVariable = this.props.activeVariableCode ?
      this.props.variables.find(_ => _.code === this.props.activeVariableCode) : null;
    return (
      <div className='table-responsive'>
        <table className='table table-condensed'>
          <tbody>
            {
              variables.map(variable => {
                var onVariableClick = this.props.onVariableToggle && variable.isSubtotal ?
                  this.props.onVariableToggle.bind(null, variable) :
                  null;
                var isActive = this.props.activeVariableCode && (
                  this.props.activeVariableCode === variable.code ||
                    activeVariable.childrenCodes && activeVariable.childrenCodes.contains(variable.code)
                );
                return (
                  <tr
                    className={cx({active: isActive})}
                    key={variable.code}
                    onMouseOut={this.handleVariableHover.bind(null, null)}
                    onMouseOver={this.handleVariableHover.bind(null, variable)}
                    style={{cursor: variable.isSubtotal ? 'pointer' : null}}>
                    <td
                      onClick={onVariableClick}
                      style={{
                        fontWeight: variable.depth === 0 ? 'bold' : null,
                        paddingLeft: variable.depth > 1 ? (variable.depth - 1) * 20 : null,
                        textDecoration: variable.code === this.state.hoveredVariableCode &&
                          variable.isSubtotal ? 'underline' : null,
                      }}>
                      {variable.isSubtotal ? `${variable.isCollapsed ? '▶' : '▼'} ${variable.name}` : variable.name}
                    </td>
                    <td
                      className='text-right'
                      onClick={onVariableClick}
                      style={{
                        color: variable.isSubtotal && ! variable.isCollapsed && this.props.expandedSubtotalColor,
                        fontStyle: variable.isSubtotal && 'italic',
                        fontWeight: variable.depth === 0 ? 'bold' : null,
                      }}>
                      {this.props.formatNumber(variable.value) + ' €' /* jshint ignore:line */}
                    </td>
                    <td onClick={onVariableClick}>
                      {
                        (! variable.isSubtotal || variable.isCollapsed) && (
                          <div style={{
                            backgroundColor: this.props.displayVariablesColors ?
                              (variable.color ? `rgb(${variable.color.join(',')})` : this.props.noColorFill) :
                              (variable.value > 0 ? this.props.positiveColor : this.props.negativeColor),
                            border: '1px solid gray',
                            width: 20,
                          }}>
                            { /* jshint ignore:line */}
                          </div>
                        )
                      }
                    </td>
                    <td>
                      {
                        variable.url && (
                          <Tooltip placement='left'>
                            <a
                              href={variable.url}
                              target='_blank'
                              title={`Explication sur ${variable.name}`}>
                              <span className='glyphicon glyphicon-question-sign'></span>
                            </a>
                          </Tooltip>
                        )
                      }
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
    );
  },
});

module.exports = VariablesTree;
