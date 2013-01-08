/**
 * ###########################################
 * ################ SINGULAR #################
 * ###########################################
 *    (C) 2013 William Lahti. MIT LICENSED
 */

!function(document, $, undefined) {
	if (window.__singular_init)
		return;
	
	window.__singular_init = true;
	
	SingularView = Class.extend({
		init: function($model, $attachPoint) {
			if (typeof $attachPoint == 'undefined')
				$attachPoint = null;
			else
				this.install($attachPoint);
		},

		$attachPoint: null,
		$model: null,

		setup: function() {
			// Do something with $attachPoint and $model
		},

		install: function($attachPoint) {
			this.$attachPoint = $attachPoint;
			this.setup();
		}
	});

	$appModel = null;

	SingularModel = Class.extend({
		init: function(parent) {
			if (typeof parent == 'undefined')
				parent = $appModel;
			
			this.parent = parent;
			this.watchers = {};
			this.attributes = {};
			this.anyWatchers = [];
		},

		attributes: null,
		watchers: null,
		anyWatchers: null,

		parent: null,
		parentPrefix: '',
		forwardChanges: false,

		update: function(callback) {
			callback.apply(this, []);
		},

		watchAny: function(callback) {
			this.anyWatchers.push(callback);
		},

		use: function(namespace) {
			var submodel = new SingularModel(this);
			submodel.forwardChanges = true;
			submodel.parentPrefix = namespace;

			return submodel;
		},

		add: function(name, item) {
			var array = this.get(name);

			if (!(array instanceof Array)) {
				array = [];
			}

			array.push(item);

			this.set(name, array);
		},

		get: function(name) {
			if (name == '$')
				return this.attributes;

			var pathStr = name.replace(/\[/, '.[').replace(/\]/, ']');

			var path = pathStr.split('.');
			var index = 0;
			var current = null;

			if (typeof this.attributes[path[0]] !== 'undefined')
				current = this.attributes[path[0]];
			else
				current = null;

			++index;

			while (current != null && index < path.length) {
				var component = path[index];

				if (component.charAt(0) == '[') {
					var sub = parseInt(component.substr(1, component.length - 2));
					current = current[sub];
					++index;
					continue;
				}

				if (current[component]) {
					current = current[component];
					++index;
				} else {
					current = null;
					break;
				}
			}

			if (current !== null)
				return current;
			
			if (this.parent != null) {
				var v;
				
				if (this.parentPrefix == '') {
					v = this.parent.get(this.parentPrefix+'.'+name);
				
					if (v != null)
						return v;
				}
				
				v = this.parent.get(name);
				
				return v;
			}
		},

		evaluate: function(expr) {
			var tokens = [];
			var buf = [];
			var str = false;
			var self = this;

			for (var i = 0; i < expr.length; ++i) {
				var ch = expr[i];

				if (str === false && ch == ' ') {
					tokens.push(buf.join(''));
					buf = [];
				} else {
					if (ch == '\'') {
						if (str === false)
							str = i;
						else
							str = false;
					}
					buf.push(ch);
				}
			}

			if (str !== false) {
				throw new Error('singular: Parse error: Unterminated string literal started at column '+str);
			}

			var dependencies = [];

			var resolve = function(t) {
				if (t[0] == '\'') {
					return t.substr(1, t.length-2);
				}

				if (!isNaN(t)) {
					return parseFloat(t);
				}

				if ($.inArray(t, dependencies) < 0)
					dependencies.push(t);
				var value = self.get(t);

				if (typeof value == 'undefined')
					value = '';

				return value;
			};

			if (buf.length > 0)
				tokens.push(buf.join(''));

			var truth = false;
			var evaluator;
			var map = {};

			if (tokens.length == 3) {
				var lhs = resolve(tokens[0]);
				var oper = tokens[1]; 
				var rhs = resolve(tokens[2]);

				var operators = {
					'==': function(a,b) { return a == b; },
					'!=': function(a,b) { return a != b; },
					'>': function(a,b) { return a > b; },
					'<': function(a,b) { return a < b; },
					'>=': function(a,b) { return a >= b; },
					'<=': function(a,b) { return a <= b; }
				}

				if (operators[oper]) {
					var operator = operators[oper];
					evaluator = function(map) { return operator(resolve(map.lhs), resolve(map.rhs)); };
					map.lhs = tokens[0];
					map.rhs = tokens[2];
					
					if (dependencies.length == 0) {
						// Static optimization

						var value = evaluator(map);
						evaluator = function(map) { return value; };
						map = {};
					}

				} else {
					throw new Error('singular: Unsupported operator '+oper);
				}

			} else if (tokens.length == 1) {
				var token = tokens[0];
				var inverted = false;

				if (token[0] == '!') {
					inverted = true;
					token = token.substr(1);
				}

				if (inverted)
					evaluator = function(map, $model) { return !resolve(map.token); };
				else
					evaluator = function(map, $model) { return resolve(map.token); };
				map.token = token;
			} else {
				throw new Error('singular: Unsupported operation \''+expr+'\'');
			}

			truth = evaluator(map);
			
			return {
				result: truth,
				map: map,
				evaluator: evaluator,
				dependencies: dependencies,
				evaluate: function() {
					return this.evaluator(this.map);
				}
			}
		},

		watchExpr: function(expr, responder, immediate) {
			if (typeof immediate == 'undefined')
				immediate = true;

			var compiled = this.evaluate(expr);
			var self = this;

			if (immediate) {
				responder(compiled.result);
			}

			$(compiled.dependencies).each(function(i,dep) {
				self.watch(dep, function(v) {
					var state = compiled.evaluate();
					responder(state);
				}, false);
			});
		},

		watch: function(name, responder, immediate) {

			var self = this;
			
			if (typeof immediate == 'undefined')
				immediate = true;

			if (name instanceof Array) {
				$(name).each(function(i,e) {
					self.watch(e,responder,immediate);
				});
				return;
			}

			if (!this.watchers[name])
				this.watchers[name] = [];

			if (immediate)
				responder(this.get(name));

			console.log('attaching watcher to '+name+', parent: '+this.parentPrefix);
			this.watchers[name].push(responder);

			if (this.forwardChanges && this.parent) {
				console.log('attaching parent watcher to '+this.parentPrefix+'.'+name);
				this.parent.watch(this.parentPrefix+'.'+name, responder, false);
			}
		},

		_fireResponders: function(name, value, oldValue) {
			if (!this.watchers[name])
				return;

			if (typeof oldValue == 'undefined')
				oldValue = null;

			$(this.anyWatchers).each(function(i,e) {
				e(name, value);
			});

			$(this.watchers[name]).each(function(i,e) {
				console.log('firing change');
				e(value);
			});

			// Notify watchers on all parents
			
			if (name.indexOf('.') >= 0) {
				var rent = name.substr(0, name.lastIndexOf('.'));
				this._fireResponders(rent, this.get(rent));
			}

			// Notify watchers on all children

			for (var key in value) {
				this._fireResponders(name+'.'+key, value);
			}

			// Notify watchers on deleted properties of children

			if (oldValue != null) {
				for (var key in oldValue) {
					if (!value[key]) {
						this._fireResponders(name+'.'+key, undefined, oldValue[key]);
					}
				}
			}

			if (this.forwardChanges) {
				console.log('forwarding changes to parent scope at '+this.parentPrefix+name);
				this.parent.set(this.parentPrefix+name);
			}
		},

		set: function(name, value) {
			if (name == '$') {
				this.attributes = value;
				return;
			}

			if (typeof value == 'undefined') {
				value = this.get(name); // trigger a change without a change
			}

			if (this.forwardChanges && this.parent != null)
				return this.parent.set((this.parentPrefix != '' ? this.parentPrefix+'.' : '') + name, value);
			
			if (false && typeof value == 'object' && !(value instanceof Array)) {
				for (var key in value) {
					if (key == 'self') {
						this.set(name, value[key]);
						continue;
					}

					this.set(name+'.'+key, value[key]);
				}
			} else {
				var oldValue = null;
				
				if (name.indexOf('.') >= 0) {
					var rent = name.substr(0, name.lastIndexOf('.'));
					var leaf = name.substr(name.lastIndexOf('.')+1);
					var rentObj = this.get(rent);

					if (rentObj == null) {
						rentObj = {};
						this.set(rent, rentObj);
					}
					
					if (rentObj[leaf])
						oldValue = rentObj[leaf];

					rentObj[leaf] = value;
				} else {
					if (this.attributes[name])
						oldValue = this.attributes[name];
					
					this.attributes[name] = value;
				}

				this._fireResponders(name, value, oldValue);
			}
		}
	});

	/////////////////////////////////////////////////////////////////////////
	/////////// $appModel
	
	$appModel = new SingularModel();
	$appModel.set('loggedIn', false);
	$appModel.set('user', null);

	/////////////////////////////////////////////////////////////////////////
	/////////// $.fn.singular

	$.fn.singular = function($model, options)
	{
		var options = $.extend({
			context: this
		}, options || {});

		$.fn.singular.installer(this);

		if (typeof $model == 'undefined')
			$model = $appModel;

		if (!($model instanceof SingularModel)) {
			var data = $model;
			$model = new SingularModel($appModel);
			$model.attributes = data || {};
		}

		var isNestedInEach = function(e) {
			if ($(e).parents('[sg\\:each]').length > 0)
				return true; 
			return false;	
		};

		var isNestedInUse = function(e) {
			if ($(e).parents('[sg\\:use]').length > 0)
				return true; 
			return false;	
		};

		var ctx = this;
		var handlers = {};
		var calculateUsePrefix = function(e) {
			// Determine the model prefix string for the given element
			// (based on sg:use elements)

			var prefix = [];

			$($(e).parents('[sg\\:use]').get().reverse()).each(function(i,e) {
				var $submodel = $model;
				var use = $(e).attr('sg:use');

				$(use.split('.')).each(function(i,component) {
					prefix.push(component);
				});
			});

			return prefix.join('.')+(prefix.length?'.':'');
		};

		handlers.each = function(e) {
			var prop = $(e).attr('sg:each');
			var nodes = $('> *', $(e)).clone();
			var watcher;
			var pageWatcherInstalled = false;

			var prefix = calculateUsePrefix(e);
			$model.watch(prefix+prop, watcher = function(value) {
				console.log('regen list');
				$(e).html('');

				var min = 0;
				var max = value? value.length : 0;
				var perPage = 10;
				var page = 1;
				var dynamicPage = false;
				
				if ($(e).attr('sg:perPage'))
					perPage = parseInt($(e).attr('sg:perPage'));

				if ($(e).attr('sg:page')) {
					page = $(e).attr('sg:page');

					if (page.charAt(0) == '$') {
						var resrc = page.substr(1);
						page = parseInt($model.get(resrc));
						
						if (!pageWatcherInstalled) {
							$model.watch(resrc, function(value) {
								var value2 = $model.get(prop);
								watcher(value2);
							}, false);
							pageWatcherInstalled = true;
						}
					} else {
						page = parseInt(page);
					}

					min = (page-1)*perPage;
					max = perPage;
				}

				if ($(e).attr('sg:max')) {
					max = Math.min(max, parseInt($(e).attr('sg:max')));
				}

				if ($(e).attr('sg:min')) {
					min = Math.max(min, parseInt($(e).attr('sg:min')));
				}
				
				$(value).each(function(i,item) {
					if (i < min || i >= max)
						return;
					
					var instance = nodes.clone();
					var container = $('<div></div>').append(instance);

					var $submodel = new SingularModel($model);
					$submodel.parentPrefix = prefix+prop+'['+i+']';
					$submodel.forwardChanges = true;
					
					$submodel.watchAny(function(key, value) {
						// Trigger a "change" on the "eached" property
						$model.set(prefix+prop+'['+i+']');
					});

					$submodel.attributes = item;
					$(container).singular($submodel);
					$(container).find('> *').detach();
					$(e).append(instance);
				});
			});
		};

		handlers.map = function(e) {
			var map = $(e).attr('sg:map').split(';');

			$(map).each(function(i,pair) {
				var kv = pair.split(':', 2);
				var attrName = kv[0], modelName = kv.length > 1 ? kv[1] : '';

				if (attrName == '' || modelName == '')
					return;

				$model.watch(modelName, function(value) {
					console.log('setting attr '+attrName+' to '+value);
					$(e).attr(attrName, value);
				});
			});
		};

		handlers.visible = function(e) {
			var expr = $(e).attr('sg:visible');

			$model.watchExpr(expr, function(value) {
				if (value) {
					$(e).show();
				} else {
					$(e).hide();
				}
			});
		};
		handlers.selected = function(e) {
			if ($(this).parents('[sg\\:each]').length > 0)
				return; // dont precalculate!

			var expr = $(e).attr('sg:selected');

			$model.watchExpr(expr, function(value) {
				if (value) {
					$(e).prop('selected', true);
				} else {
					$(e).prop('selected', false);
				}
			});
		};

		handlers.checked = function(e) {
			var expr = $(e).attr('sg:checked');

			$model.watchExpr(expr, function(value) {
				if (value) {
					$(e).prop('checked', true);
				} else {
					$(e).prop('checked', false);
				}
			});
		};

		handlers.click = function(e) {
			var handler = $(e).attr('sg:click');
			$(e).click(function() {
				console.log($model);
				eval(handler);
			});
		};

		handlers.model = function(e) {
			var prefix = calculateUsePrefix(e);
			var attr = $(e).attr('sg:model');
			var value = $model.get(prefix+attr);

			if (e.nodeName == 'INPUT' || e.nodeName == 'TEXTAREA') {
				var mode = $(e).attr('sg:mode') || 'instant';

				if (mode == 'instant') {
					$(e).keypress(function(ev) {
						setTimeout(function() {
							$model.set(prefix+attr, $(e).val());
						}, 1);
					});
				} 
				$(e).change(function(ev) {
					$model.set(prefix+attr, $(e).val());
				});
			} else if ($(e).attr('contenteditable')) {
				var mode = $(e).attr('sg:mode') || 'instant';

				if (mode == 'instant') {
					$(e).keypress(function(ev) {
						setTimeout(function() {
							$model.set(prefix+attr, $(e).html());
						}, 1);
					});
				} 
				$(e).blur(function(ev) {
					$model.set(prefix+attr, $(e).html());
				});
			}

			if (e.nodeName == 'INPUT' || e.nodeName == 'TEXTAREA') {
				$model.watch(prefix+attr, function(value) {
					$(e).val(value);
					$.fn.singular.installer($(e));
				});
			} else {
				$model.watch(prefix+attr, function(value) {
					$(e).html(value);
					$.fn.singular.installer($(e));
				});
			}
		};

		var attrList = [];
		var operations = [];
		for (var oper in handlers) {
			attrList.push('[sg\\:'+oper+']');
			operations.push(oper);
		}

		attrList = attrList.join(', ');

		if (true) $(ctx).find(attrList).each(function(i,e) {
			$(operations).each(function(oo,oper) {
				if ($(e).attr('sg:'+oper) == undefined)
					return;

				handlers[oper](e);
				$(e).attr('sg:'+oper, '');
				return false;
			});
		});

		/*
		$(ctx).find('[sg\\:each]').each(function(i,e) {
			handleEach(e);
		});

		$(ctx).find('[sg\\:map]').each(function(i,e) {
			if (isNestedInEach(e))
				return;

			handleMap(e);
		});

		$(ctx).find('[sg\\:visible]').each(function(i,e) {
			if (isNestedInEach(e))
				return;

			handleVisible(e);
		});

		$(ctx).find('[sg\\:selected]').each(function(i,e) {
			if (isNestedInEach(e))
				return;

			handleSelected(e);
		});


		$(ctx).find('[sg\\:checked]').each(function(i,e) {
			if (isNestedInEach(e))
				return;

			handleChecked(e);
		});


		$(ctx).find('[sg\\:click]').each(function(i,e) {
			if (isNestedInEach(e))
				return;

			handleClick(e);
		});
		$(ctx).find('[sg\\:model]').each(function(i,e) {
			if (isNestedInEach(e))
				return;

			handleModel(e);
		});
		*/
	};
	$.fn.singular.installer = function() { };
}(document, jQuery);
