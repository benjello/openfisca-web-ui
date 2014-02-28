define([
	'jquery',
	'underscore',
	'backbone',
	'd3',

	'chartM',
	'helpers',
	], function ($, _, Backbone, d3, chartM, helpers) {
		'use strict';

		d3.selection.prototype.moveToFront = function() { return this.each(function(){ this.parentNode.appendChild(this); }); };
		d3.selection.prototype.moveToBack = function() {return this.each(function() {var firstChild = this.parentNode.firstChild;if (firstChild) {this.parentNode.insertBefore(this, firstChild);}});};

		var WaterfallChartV = Backbone.View.extend({

			/* Properties */
			model: chartM,
			views: [],

			/* Settings */
			padding: {
				top: 50,
				right: 40,
				bottom: 90,
				left: 50,
			},
			margin: {
				top: 0,
				left: 0,
				bottom: 0,
				right: 80
			},
			innerPadding: 10,

			title: '',

			currentDataSet: {},
			bars: [],
			stopValues: {},

			positiveColor: '#6aa632',
			negativeColor: '#b22424',

			/* Settings */

			initialize: function (parent) {

				this._el = d3.select(parent.el).append('div')
					.attr('id', 'waterfall-chart');
				this.setElement(this._el[0]);

				this.g = d3.select(this.el).append('svg');

				this.height = parent.height - this.margin.bottom - this.margin.top;
				this.width = parent.width - this.margin.left - this.margin.right;

				this.g
					.attr('height', this.height)
					.attr('width', this.width);

				if(this.model.fetched) this.render();
				this.listenTo(this.model, 'change:source', this.render);
			},
			render: function (args) {

				var args = args || {};
				if(_.isUndefined(args.getDatas) || args.getDatas) this.setData(this.model.get('waterfallData'));

				this.buildBars({endTransitionCallback: this.buildActiveBars});

				if(_.isUndefined(this.xAxis) && _.isUndefined(this.yAxis)) this.buildLegend();
				else this.updateLegend();

				return this;
			},
			_events: function () {
				var that = this;
				this.g.on('click', function (d) {
					that.updateScales();		
				});
			},
			setData: function (data) {
				/* Set stopvalues */
				var children = data,
					childrenLength = children.length,
					that = this;

				this.currentDataSet = data;

				var baseHeight = 0, _baseHeight = 0;
				_.each(this.currentDataSet, function (d) {
					_baseHeight += d.value;
					d.waterfall = {
						'startValue': baseHeight,
						'endValue': _baseHeight
					};
					baseHeight += d.value;
				});

				this.updateScales();
			},
			updateScales: function (args) {
				var args = args || {},
					that = this,
					currentDataSetValues = _.map(this.currentDataSet, function (data) {
						return [data.waterfall.startValue, data.waterfall.endValue];
				});

				if(!_.isUndefined(args.yValues)) {

					var yMin = d3.min(args.yValues),
						yMax = d3.max(args.yValues);

					this.scales = {
						x: d3.scale.ordinal()
							.rangeBands([this.padding.left, that.width-this.padding.right], 0, 0)
							.domain(that.currentDataSet.map(function(d) {
								return d.name;
						})),
						y: d3.scale.linear()
							.domain([d3.min(args.yValues), d3.max(args.yValues)])
							.range([that.height - that.padding.bottom, that.padding.top])
					};


					if(_.isUndefined(this.backToGlobalScaleButton)) {
						this.backToGlobalScaleButton = this.g.append('text')
								.attr('class', 'back-to-global-scale-button')
								.text('Retour à la globale')
								.attr('x', function () {
									return that.width/2;
								})
								.attr('y', function () {
									return that.padding.top;
								})
								.attr('text-anchor', 'middle')
								.on('click', function () {
									that.updateScales();
									that.render({getDatas: false});
								});
					}
					

				}
				else {
					/* Set scales */
					var yMin = d3.min(currentDataSetValues, function (d) { return d3.min(d);}),
						yMax = d3.max(currentDataSetValues, function (d) { return d3.max(d);});
					this.scales = {
						x: d3.scale.ordinal()
							.rangeBands([this.padding.left, that.width-this.padding.right], 0, 0)
							.domain(that.currentDataSet.map(function(d) {
								return d.name;
						})),
						y: d3.scale.linear()
							.domain([yMin, yMax])
							.range([that.height - that.padding.bottom, that.padding.top])
					};

					if(!_.isUndefined(this.backToGlobalScaleButton)) {
						this.backToGlobalScaleButton
							.on('click', null)
							.transition().duration(100)
							.remove();
						this.backToGlobalScaleButton = undefined;
					}
				}
				var magnitude = (Math.abs(yMin) > Math.abs(yMax)) ? Math.abs(yMin): Math.abs(yMax);
				this.prefix = d3.formatPrefix(magnitude);
				this.prefix._scale = function (val) {
					if(	that.prefix.symbol != 'G' && that.prefix.symbol != 'M' && that.prefix.symbol != 'k' && that.prefix.symbol != '') {
						return (""+ d3.round(val, 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
					}
					var roundLevel = (that.prefix.symbol == 'G' || that.prefix.symbol == 'M') ? 2: 0;
					if(that.prefix.symbol == 'k') val = that.prefix.scale(val)*1000;
					else val = that.prefix.scale(val);
					return (""+ d3.round(val, roundLevel)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
				};
				switch(this.prefix.symbol) {
					case 'G':
						this.legendText = 'Milliards €';
						this.prefix.symbolText = 'milliards\n€';
						break;
					case 'M':
						this.legendText = 'Millions €';
						this.prefix.symbolText = 'millions\n€';
						break;
					case 'k':
						this.legendText = 'Euros';
						this.prefix.symbolText = 'euros';
						break;
					case '':
						this.legendText = 'Euros';
						this.prefix.symbolText = 'euros';
					default:
						this.legendText = '';
				}
			},
			buildBars: function (args) {
				var that = this,
					dataLength = this.currentDataSet.length,
					barsLength = (!_.isUndefined(this.bars[0])) ? this.bars[0].length: 0,
					barWidth = (that.width - that.padding.left - that.padding.right - dataLength*that.innerPadding)/dataLength,
					args = args || {};
				
				this.bars = this.g.selectAll('.bar')
						.data(this.currentDataSet)

				this.bars
					.enter()
						.append('rect')
						.attr('id', function (d, i) { return 'bar-'+i; })
						.attr('class', 'bar')
						.attr('width', barWidth)
						.attr('height', 0)
						.attr("rx", 4)
    					.attr("ry", 4)
						.attr('y', function (d, i) {
							if(d.value < 0) var r = that.scales.y(d.waterfall.startValue);
							else var r = that.scales.y(d.waterfall.startValue) - (that.scales.y(d.waterfall.startValue) - that.scales.y(d.waterfall.endValue));
							return r;
						})
						.attr('x', function (d, i, a) {
							return 0;
						})
						.attr('fill', function (d) {
								if(d.value > 0) return that.positiveColor;
								else return that.negativeColor;
						})
						.attr('opacity', 0.8)
						.attr('stroke-width', 1);
				this.bars
					.transition()
						.duration(1000)
						.attr('width', barWidth)
						.attr('height', function (d) {
							if(d.value < 0) var _return = that.scales.y(d.waterfall.endValue) - that.scales.y(d.waterfall.startValue);
							else var _return = that.scales.y(d.waterfall.startValue) - that.scales.y(d.waterfall.endValue);

							return _return < 0.8 ? 0.8: _return;
						})
						.attr('x', function (d, i, a) {
								return that.scales.x(d.name) + that.innerPadding/2;
						})
						.attr('y', function (d, i) {
							if(d.value < 0) var r = that.scales.y(d.waterfall.startValue);
							else var r = that.scales.y(d.waterfall.startValue) - (that.scales.y(d.waterfall.startValue) - that.scales.y(d.waterfall.endValue));
							return r;
						})
						.attr('fill', function (d) {
							if(d.value > 0) return that.positiveColor;
							else return that.negativeColor;
						})
						.each('start', function (d) {
							if(!_.isUndefined(that.activeBars)) {
								that.activeBars.on('mouseover', null);
								that.activeBars.on('mouseout', null);
								that.activeBars.remove();
							}
							if(!_.isUndefined(that.incomeLine)) that.incomeLine.transition().duration(100).remove();
							if(!_.isUndefined(that.incomeText)) that.incomeText.transition().duration(100).remove();
						})
						.each('end',function (d, i) {
							if(!_.isUndefined(args.endTransitionCallback) && i==0) {
								args.endTransitionCallback.call(that);
							}
						});

				this.bars.exit()
					.transition()
						.duration(1000)
						.attr('x', function (d, i, a) {
							return that.width*3;
						})
						.attr('opacity', 0)
						.each('end', function () {
							this.remove();
						});

				if(_.isUndefined(this.bottomGradientProp) && _.isUndefined(this.topGradientProp)) {
					this.bottomGradientProp = this.g.append("svg:defs").append("svg:linearGradient").attr("id", "bottomBorderGradient").attr("x1", "50%").attr("y1", "0").attr("x2", "50%").attr("y2", "100%").attr("spreadMethod", "pad");
					this.bottomGradientProp.append("svg:stop").attr("offset", "0%").attr("stop-color", "#FFF").attr("stop-opacity", 0);
					this.bottomGradientProp.append("svg:stop").attr("offset", "30%").attr("stop-color", "#FFF").attr("stop-opacity", 0.5);
					this.bottomGradientProp.append("svg:stop").attr("offset", "100%").attr("stop-color", "#FFF").attr("stop-opacity", 1);

					this.topGradientProp = this.g.append("svg:defs").append("svg:linearGradient").attr("id", "topBorderGradient").attr("x1", "50%").attr("y1", "0").attr("x2", "50%").attr("y2", "100%").attr("spreadMethod", "pad");
					this.topGradientProp.append("svg:stop").attr("offset", "0%").attr("stop-color", "#FFF").attr("stop-opacity", 1);
					this.topGradientProp.append("svg:stop").attr("offset", "70%").attr("stop-color", "#FFF").attr("stop-opacity", 0.5);
					this.topGradientProp.append("svg:stop").attr("offset", "100%").attr("stop-color", "#FFF").attr("stop-opacity", 0);

					this.g.append("svg:rect")
						.attr("width", that.width+that.margin.right)
						.attr("height", that.padding.bottom)
						.attr("x", 0)
						.attr("y", that.height - that.padding.bottom)
						.style("fill", "url(#bottomBorderGradient)")

					this.g.append("svg:rect")
						.attr("width", that.width+that.margin.right)
						.attr("height", that.padding.top)
						.attr("x", 0)
						.attr("y", 0)
						.style("fill", "url(#topBorderGradient)")
				}

				if(!_.isUndefined(this.backToGlobalScaleButton)) this.backToGlobalScaleButton.moveToFront();
			},
			buildActiveBars: function () {
				var that = this,
					dataLength = this.currentDataSet.length,
					barsLength = (!_.isUndefined(this.bars[0])) ? this.bars[0].length: 0,
					barWidth = (that.width - that.padding.left - that.padding.right)/dataLength;

				this.activeBars = this.g.selectAll('.active-bar')
					.data(this.currentDataSet);

				this.activeBars
					.enter()
						.append('rect')
						.attr('id', function (d, i) { return 'active-bar-'+i; })
						.attr('class', 'active-bar')
						.attr('width', barWidth)
						.attr('height', that.height)
						.attr('y', that.padding.top)
						.attr('x', function (d, i, a) {
							return that.scales.x(d.name);
						})
						.attr('fill', function (d) {
							if(d.value > 0) return that.positiveColor;
							else return that.negativeColor;
						})
						.attr('opacity', 0)
						.on('mouseover', function (d, i) {

							var bar = d3.select('#bar-'+i),
								barAttrs = {
									x: parseInt(bar.attr('x')),
									y: parseInt(bar.attr('y')),
									width: parseInt(bar.attr('width')),
									height: parseInt(bar.attr('height')),
									fill: bar.attr('fill')
								},
								barData = bar.data()[0];

							d3.select(this)
								.transition()
								.duration(50)
									.attr('opacity', 0)

							that.showTooltip(bar);

							that.bars
								.transition()
								.duration(100)
								.attr('opacity', function (_d, _i) {
									if(_i == i) return 1;
									else return 0.8;
								});


							that.incomeLine = that.g.append('line')
								.attr('stroke', function () { return '#333'; })
								.attr('stroke-width', function () { return 2; })
								.attr('stroke-dasharray', ('3, 3'))
								.attr('opacity', 0)

								.attr('x1', function () { return barAttrs.x })
								.attr('y1', function () {  return barAttrs.y + (barData.value < 0 ? (barAttrs.height) : 0);})
								.attr('x2', function () {  return that.width; })
								.attr('y2', function () { return barAttrs.y + (barData.value < 0 ? (barAttrs.height) : 0);})
								.moveToBack();
							
							that.incomeText = that.g.selectAll('.income-number')
								.data((that.prefix._scale(barData.waterfall.endValue) + '\n'+that.prefix.symbolText).split('\n'));

							that.incomeText
								.exit()
									.transition().duration(50)
									.attr('opacity', 0)
									.remove();

							that.incomeText
								.attr('y', function (_d, _i) {
									var lineHeight = parseInt(d3.select(this).attr('font-size'))+3;
									return barAttrs.y + lineHeight * _i - (that.incomeText.data().length * lineHeight-10) + (barData.value < 0 ? (barAttrs.height) : 0);
								})
								.text(function (_d) { 
									return _d;
								})
								.attr('opacity', 1)
								.enter()
									.append('text')
									.attr('class', 'income-number')
									.attr('font-size', 15)
									.attr('x', function () { return that.width + 5 })
									.attr('y', function (_d, _i) {
										var lineHeight = parseInt(d3.select(this).attr('font-size'))+3;
										return barAttrs.y + lineHeight * _i - (that.incomeText.data().length * lineHeight-10) + (barData.value < 0 ? (barAttrs.height) : 0);
									})
									.attr('font-weight', 'bold')
									.text(function (_d) { 
										return _d;
								}
							);

							if(!_.isUndefined(d.parentNodes[0])) {
								var parentNode = d.parentNodes[0].split(' ');
								that.incomeLabel = that.g.selectAll('.income-label')
									.data(parentNode);

								that.incomeLabel
									.text(function (d) { return d; })
									.attr('y', function (_d, _i) { var lineHeight = parseInt(d3.select(this).attr('font-size'))+3; return barAttrs.y + lineHeight + _i * lineHeight + (barData.value < 0 ? (barAttrs.height) : 0); })
									.attr('x', function () { return that.width + 5 })
									.enter()
										.append('text')
										.attr('class', 'income-label')
										.attr('x', function () { return that.width + 5 })
										.attr('font-size', 12)
										.attr('font-weight', 'bold')
										.attr('y', function (_d, _i) { 
											var lineHeight = parseInt(d3.select(this).attr('font-size'))+3;
											return barAttrs.y + lineHeight + _i * lineHeight + (barData.value < 0 ? (barAttrs.height) : 0);
										})
										.text(function (d) {
											return d;
										});

								that.incomeLabel
									.exit()
										.transition().duration(100)
										.remove();
							}

							that.incomeLine
								.transition().duration(100)
								.attr('opacity', 1);
						})
						.on('mouseout', function (d, i) {

							var bar = d3.select('#bar-'+i);

							d3.select(this)
								.transition()
								.duration(50)
									.attr('opacity', 0);
							
							that.bars
								.transition()
								.duration(100)
								.attr('opacity', function (_d, _i) {
									return 0.8;
								});

							that.hideTooltip(bar);

							that.incomeLine
								.remove();

							that.incomeText
								.remove();

							

							if(!_.isUndefined(that.incomeLabel)) {
								that.incomeLabel
									.remove();
							}
						})
						.on('click', function (d) {
							var topV = d.waterfall.startValue - (d.value*3),
								bottomV = d.waterfall.endValue + (d.value*3);
							that.updateScales({ yValues: [topV, bottomV]});
							that.render({getDatas: false});
						});

				this.activeBars.moveToFront();

				this.activeBars
					.transition()
						.duration(1000)
						.attr('width', barWidth)
						.attr('height', that.height)
						.attr('x', function (d, i) {
							return that.scales.x(d.name);
						})
						.attr('y', this.padding.top)
						.attr('fill', function (d) {
							if(d.value > 0) return that.positiveColor;
							else return that.negativeColor;
						})
						.attr('opacity', 0);

				this.activeBars
					.exit()
					.remove();
			},
			updateLegend: function () {
				var that = this;

				this.xAxis.scale(this.scales.x)
				this.yAxis.scale(this.scales.y)
					.tickFormat(function (d) {
				        return that.prefix._scale(d); 
				    })

				this.yAxisLegend
					.transition()
					.duration(1000)
					.call(this.yAxis);

				this.xAxisLegend
					.transition()
					.duration(1000)
					.call(this.xAxis);

				this.g.select('.x-axis').moveToFront()
				this.g.selectAll('.x-axis .tick text')					
					.attr('transform', function (d) {
						var el = d3.select(this),
							_dim = this.getBBox();

						var deltax = _dim.width/2,
							x = _dim.x+_dim.width,
							y = _dim.y;

						return 'translate(-'+deltax+', 0) rotate(-45,'+x+', '+y+')';
					});


				var legendTextSplited = this.legendText.split('\n');
				this.legendTextObject = this.g.selectAll('.legendText_y')
					.data(legendTextSplited)

				this.legendTextObject
					.text(function (d) { return d; })
					.enter().append('svg:text')
						.attr('class', 'legendText_y')
						.attr('fill', '#333')
						.attr('x', function (d) { return that.padding.left; })
						.attr('y', function (d, i) {  return 10 + i*10; })
						.attr('font-size', 12)
						.attr('font-weight', 'normal')
						.attr('text-anchor', 'end')
						.text(function (d) { return d; });

				this.legendTextObject.moveToFront()

				this.legendTextObject.exit().remove();
			},
			buildLegend: function () {

				var that = this;
					this.xAxis = d3.svg.axis()
						.scale(this.scales.x)
						.orient("bottom")

					this.yAxis = d3.svg.axis()
						.scale(this.scales.y)
						.tickSize(this.width - this.padding.left)
						.orient("left")
						.tickFormat(function (d) {
					        return that.prefix._scale(d); 
					    })

					this.yAxisLegend = this.g.append("g");
					this.xAxisLegend = this.g.append("g");

					this.yAxisLegend
						.attr("class", "y-axis")
						.attr("transform", function () {
							var pos = that.width;
							return 'translate('+pos+',0)';
						})
						.call(this.yAxis)

					this.xAxisLegend
						.attr("class", "x-axis")
						.attr("transform", function () {
							var pos = that.height - that.padding.bottom;
							return 'translate(0,' + pos + ')';
						})
						.call(this.xAxis);


				this.g.selectAll('.x-axis .tick text')
					.attr('transform', function (d) {
						var el = d3.select(this),
							_dim = this.getBBox();

						var deltax = _dim.width/2,
							x = _dim.x+_dim.width,
							y = _dim.y;

						return 'translate(-'+deltax+', 0) rotate(-45,'+x+', '+y+')';
				});

				var legendTextSplited = this.legendText.split('\n');
				this.legendTextObject = this.g.selectAll('.legendText_y')
					.data(legendTextSplited);

				this.legendTextObject
					.enter().append('svg:text')
						.attr('class', 'legendText_y')
						.attr('fill', '#333')
						.attr('x', function (d) { return that.padding.left; })
						.attr('y', function (d, i) {  return 10 + i*10; })
						.attr('font-size', 12)
						.attr('font-weight', 'normal')
						.attr('text-anchor', 'end')
						.text(function (d) { return d; });

			},
			showTooltip: function (bar) {
				var d = bar.data()[0],
					that = this;
				/* Show tooltip */
				this.$el.append('\
					<div class="nvtooltip xy-tooltip nv-pointer-events-none" id="nvtooltip-'+d._id+'" style="opacity: 0; position: absolute;">\
						<table class="nv-pointer-events-none">\
							<thead>\
								<tr class="nv-pointer-events-none">\
									<td colspan="3" class="nv-pointer-events-none">\
										<strong class="x-value">'+d.description+'</strong>\
									</td>\
								</tr>\
							</thead>\
							<tbody>\
								<tr class="nv-pointer-events-none">\
									<td>'+that.prefix._scale(d.value)+' '+this.prefix.symbolText+'</td>\
								</tr>\
							</tbody>\
						</table>\
					</div>\
				');
				var svg = this.$el.find('svg');
				// console.log(bar.getBBox());

				var barBBox = {};
					bar.each(function () { barBBox = this.getBBox(); });

				d3.select(this.el).select('#nvtooltip-'+d._id)
					.style('left', function () {

						var tooltipWidth = $(this).width();

						var xPos = bar.attr('x') - (that.width * 2/3 < bar.attr('x') ? (tooltipWidth - barBBox.width): 0);
						return xPos + 'px';
					})
					.style('top', function () {
						var yPos = bar.attr('y');
						return yPos + 'px';
					})
					.transition().duration(100)
						.style('opacity', 1);

				/* Add bubble style */
				bar.attr('stroke-width', 3);
			},
			hideTooltip: function (bar) {
				var d = bar.data()[0];
				d3.select(this.el).select('#nvtooltip-'+d._id)
					.transition().duration(100)
						.style('opacity', 0)
						.remove();

				bar.attr('stroke-width', 1);
			},
			_remove: function () {
				
			}
		});
	return WaterfallChartV;
});
