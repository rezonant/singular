/**
 * ###########################################
 * ################ SINGULAR #################
 * ###########################################
 *    (C) 2013 William Lahti. MIT LICENSED
 */

!function(document, $, console, undefined) {
	var devMode = false;		// Set to true to enable console.log within this module

	if (window.__singular_init)
		return;

	window.__singular_init = true;

	if (!devMode)
		console = { log: function(m) { } };

	/////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Determine if we are nested within an sg:each, sg:view, or any other
	 * late-bound Singular construct.
	 *
	 */
	var isNested = function(e) {
		var found = false;
		var attributes = [
			'each', 'view', 'ignore'
		];

		$(e).parents().each(function(i,parent) {
			if ($(parent).hasClass('sgTemplate')) {
				found = true;
				return;
			}
			$(attributes).each(function(attrID, attribute) {
				var value = $(parent).attr('sg:'+attribute);

				if (value === undefined)
					return;

				if (attribute == 'ignore' || (value != '' && value[0] != '#')) {
					found = true;
					return false;
				}
			});
		});

		return found;
	};

	
	var isNestedInUse = function(e) {
		if ($(e).parents('[sg\\:use]').length > 0)
			return true;
		return false;
	};

	var calculateUsePrefix = function(e, $model) {
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


	SingularView = Class.extend({
		init: function($model, $attachPoint) {
			if (typeof $attachPoint != 'undefined')
				this.install($attachPoint);

			this.$model = $model;
		},

		$attachPoint: null,
		$model: null,

		/**
		 * @abstract
		 */
		setup: function() {
			// Do something with $attachPoint and $model
		},

		install: function($attachPoint) {
			this.$attachPoint = $attachPoint;
			$attachPoint.sgView = this;

			this.setup();
		}
	});


	SingularInspector = SingularView.extend({
		setup: function() {
			var self = this;
			$(this.$attachPoint).find('.hider a.hideInspector').click(function(ev) {
				self.hide();
			});
		},

		show: function() {
			$(this.$attachPoint).find('.panel').animate({top: 0});
			$(this.$attachPoint).find('.launcher').animate({bottom: '-20em'});
		},

		hide: function() {
			$appModel.set('sgInspector.lookup', '');
			$appModel.set('sgInspector.answer', '');
			
			$(this.$attachPoint).find('.panel').animate({top: '-20em'});
			$(this.$attachPoint).find('.launcher').animate({bottom: '-2px'});
		}
	});
	
	SingularInspector.install = function() {
		if ($('#-SingularInspector').length == 0) {
			$('body').append($('<div id="-SingularInspector" class="sgInspector sgTemplate" sg:use="sgInspector">'+
				'<div class="launcher">'+
					'<a href="javascript:;" onclick="$(this).parents(\'.sgInspector:first\').prop(\'sgView\').show();">Singular</a>'+
				'</div>'+

				'<div class="panel">' +
					'<div class="message">Enter attribute path below to inspect and change values.</div>' +
					'<div class="hider"><a href="javascript:;" class="hideInspector">Hide</a></div>' +

					'<img src="img/singular.png" class="sgLogo" />' +
					'<div style="height:2em;">' +
					'</div>' +

					'<input type="text" style="width:100%" sg:model="lookup" placeholder="Type attribute..." /><br/>' +
					'<div sg:model="nav"></div>' +
					'<span class="answer" sg:model="answer"' +
						  'sg:map="contenteditable:isAnswerEditable"' +
						  'contenteditable="true"><em>Value will appear here.</em></span>' +
				'</div>' +
			'</div>'));
		}

		// We'll install a dependency between sgInspectorLookup and sgInspectorAnswer.
		var ignoreChange = false;
		$appModel.watch('sgInspector.lookup', function(value) {
			var v = $appModel.get(value);
			if (v === undefined)
				v = '<em>No value set. Click to set one.</em>';

			if (value == '')
				v = $appModel.attributes;

			if (typeof v == 'object') {
				var members = [];
				var isArray = (v instanceof Array);
				$appModel.set('sgInspector.isAnswerEditable', 'false');

				for (var key in v) {
					var val = v[key];
					var newKey = key;

					if (value != '') {
						if (isArray)
							newKey = value+'['+key+']';
						else
							newKey = value+'.'+key;
					}

					if (typeof val == 'object') {
						if (val instanceof Array)
							val = 'Array [ '+val.join('<br/>&nbsp;&nbsp;&nbsp;&nbsp;')+' ]';
					}

					if (isArray) {
						members.push('<li><a href="javascript:;" onclick="$appModel.set(\'sgInspector.lookup\', \''+newKey+'\');">[ '+key+' ]</a>: '+val+'</li>');
					} else {
						members.push('<li><a href="javascript:;" onclick="$appModel.set(\'sgInspector.lookup\', \''+newKey+'\');">'+key+'</a>: '+val+'</li>');
					}
				}

				v = '<ul>'+members.join('')+'</ul>';
			} else {
				$appModel.set('sgInspector.isAnswerEditable', 'true');
			}

			if (value == '') {
				$appModel.set('sgInspector.nav', '');
			} else if (value.match(/\[[0-9]+\]$/)) {
				var rentAttr = value.substr(0, value.lastIndexOf('['));
				$appModel.set('sgInspector.nav', '<a href="javascript:;" onclick="$appModel.set(\'sgInspector.lookup\', \''+rentAttr+'\');">Up to '+rentAttr+'</a>');
			} else if (value.indexOf('.') >= 0) {
				var rentAttr = value.substr(0, value.lastIndexOf('.'));
				$appModel.set('sgInspector.nav', '<a href="javascript:;" onclick="$appModel.set(\'sgInspector.lookup\', \''+rentAttr+'\');">Up to '+rentAttr+'</a>');
			} else {
				$appModel.set('sgInspector.nav', '<a href="javascript:;" onclick="$appModel.set(\'sgInspector.lookup\', \'\');">Up to $appModel</a>');
			}

			ignoreChange = true;
			$appModel.set('sgInspector.answer', v);
		}, false);

		$appModel.watch('sgInspector.answer', function(value) {
			if (ignoreChange) {
				ignoreChange = false;
				return;
			}

			var name = $appModel.get('sgInspector.lookup');

			ignoreChange = true;
			$appModel.set(name, value);
			ignoreChange = false;
		}, false);
	};


	$appModel = null;

	SingularModel = Class.extend({
		init: function(parent, namespace) {

			if (typeof parent == 'undefined')
				parent = $appModel;

			if (typeof namespace == 'undefined')
				namespace = '';
			
			this.parent = parent;
			this.parentPrefix = namespace;
			this.forwardChanges = (this.parent != null);
			
			this.watchers = {};
			this.attributes = {};
			this.anyWatchers = [];
		},

		where: function() {
			if (this.parent)
				return this.parent.where()+'.'+this.parentPrefix;
			else
				return '$appModel';
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
			if (namespace === undefined || namespace == '')
				return this;

			var submodel = new SingularModel(this, namespace);

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
			if (typeof name == 'undefined') {
				return null;
			}

			if (name == '$') {
				if (this.parent && this.parentPrefix) {
					return this.parent.get(this.parentPrefix);
				} else {
					return this.attributes;
				}
			}

			var pathStr = name.replace(/\[/, '.[').replace(/\]/, ']');

			while (pathStr[0] == '.')
				pathStr = pathStr.substr(1);

			var path = pathStr.split('.');
			var index = 1;
			var current = null;

			if (typeof this.attributes[path[0]] !== 'undefined')
				current = this.attributes[path[0]];
			else
				current = null;

			while (current != null && index < path.length) {
				var component = path[index];

				if (component == '') {
					++index;
					continue;
				}

				if (component.charAt(0) == '[') {
					var sub = parseInt(component.substr(1, component.length - 2));
					current = current[sub];
					++index;
					continue;
				}

				if (component == '@') {
					current = this.where()+'.'+path.slice(0, index).join('.');
					++index;
				} else if (current[component]) {
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
			if (typeof name == 'undefined')
				return false;

			if (name == '$') {
				this.attributes = value;
				return;
			}

			if (typeof value == 'undefined') {
				value = this.get(name); // trigger a change without a change
			} else {
				// don't trigger changes if there is no change
				// But always run for objects/arrays

				var oldValue = this.get(name);

				if (typeof value != 'object' && oldValue == value)
					return;
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
	/////////// $.fn.sgView

	window.sgInspect = function()
	{
		var nodes = $('<div></div>');
		$('body').append(nodes);
		$(nodes).sgView('SingularInspector');

		return nodes.get(0).sgView;
	};

	$.fn.sgView = function(type, $model) {
		if (typeof $model == 'undefined')
			$model = $appModel;

			var e;
		// If the view class has a static install(), run it.
		// It can do things like prepare the '#-ViewClassHere'
		// element which should contain the markup for this class.

		if (window[type] && window[type].install)
			window[type].install();

		// Install said #-ViewClassHere markup if we find it.

		if ($('#-'+type).length > 0) {
			var chunk = $('#-'+type).contents().clone();
			$(this).append(chunk);

			var self = this;

			$($('#-'+type).get(0).attributes).each(function(i,e) {
				if (e.name == 'id')
					return;
				
				$(self).attr(e.name, e.value);
			});

			$(self).removeClass('sgTemplate');
		}

		// Prepare to run Singular on the whole shebang
		// We'll use our parent context unless sg:model is
		// present, if so we'll build a submodel.
		// Don't forget to calculate the sg:use chain.

		var prefix = calculateUsePrefix(this);
		var $subModel = $model.use(prefix);

		if ($(this).attr('sg:model'))
			$subModel = $model.use($(this).attr('sg:model'));

		// Construct the view instance and attach it to the DOM element.

		if (window[type])
			this.prop('sgView', new window[type]($subModel, this.get(0)));

		// Run Singular on the new view markup. Good luck little baby views!

		$(this).singular($subModel);
	};

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

		/**
		 * Singular Handlers
		 * Each member of the handlers object defined below is a callback
		 * that is invoked when an attribute of the same name as the handlers
		 * member, except prefixed with 'sg:'. IE, handlers.each is called when
		 * sg:each is spotted in the document.
		 */

		var handlers = {};

		handlers.view = function(e) {
			var type = $(e).attr('sg:view');

			$(e).attr('sg:view', '#'+type);
			
			if ($(e).attr('sg:each') !== undefined)
				return false;	// each does it's own sg:view handling

			$(e).sgView(type);
		};

		handlers.each = function(e) {
			var prop = $(e).attr('sg:each');
			var nodes;

			if ($(e).attr('sg:view') !== undefined) {
				var viewClass = $(e).attr('sg:view');

				if (viewClass[0] == '#')
					viewClass = viewClass.substr(1);

				nodes = $('#'+viewClass).contents().clone();
			} else {
				nodes = $('> *', $(e)).clone();
			}
			var watcher;
			var pageWatcherInstalled = false;

			var prefix = calculateUsePrefix(e, $model);
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
					var $submodel = $model.use(prefix+prop+'['+i+']');

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
				var prefix = calculateUsePrefix(e, $model);
				if (attrName == '' || modelName == '')
					return;

				$model.watch(prefix+modelName, function(value) {
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

			if ($(e).attr('sg:view'))
				return false;		// view does its own sg:model handling

			var prefix = calculateUsePrefix(e, $model);
			var attr = $(e).attr('sg:model');
			var value = $model.get(prefix+attr);
			var ignoreChange = false;
			var mode = $(e).attr('sg:mode') || 'instant';

			// mode should be 'blur' to indicate non-instant change tracking

			if (e.nodeName == 'INPUT' || e.nodeName == 'TEXTAREA') {

				if (mode == 'instant') {
					$(e).keydown(function(ev) {
						setTimeout(function() {
							ignoreChange = true;
							$model.set(prefix+attr, $(e).val());
							ignoreChange = false;
						}, 1);
					});
				}

				$(e).change(function(ev) {
					$model.set(prefix+attr, $(e).val());
				});
			} else if ($(e).attr('contenteditable')) {

				if (mode == 'instant') {
					$(e).keydown(function(ev) {
						if ($(e).attr('contenteditable') !== 'true')
							return;	// editing is currently disabled.

						setTimeout(function() {
							ignoreChange = true;
							$model.set(prefix+attr, $(e).html());
							ignoreChange = false;
						}, 1);
					});
				}
				$(e).blur(function(ev) {
					ignoreChange = true;
					$model.set(prefix+attr, $(e).html());
					ignoreChange = false;
				});
			}

			if (e.nodeName == 'INPUT' || e.nodeName == 'TEXTAREA') {
				$model.watch(prefix+attr, function(value) {

					if (ignoreChange) return;
					$(e).val(value);
					$.fn.singular.installer($(e));
				});
			} else {
				$model.watch(prefix+attr, function(value) {
					if (ignoreChange) return;
					$(e).html(value);
					$.fn.singular.installer($(e));
				});
			}
		};

		/**
		 * Find all usages of all registered operations and
		 * run their designated handlers. This is how sg:xxx
		 * attributes are mapped to handlers.xxx above.
		 */

		var attrList = [];
		var operations = [];
		for (var oper in handlers) {
			attrList.push('[sg\\:'+oper+']');
			operations.push(oper);
		}

		attrList = attrList.join(', ');
		$(this).find(attrList).each(function(i,e) {
			if ($(e).attr('sg:ignore') !== undefined)
				return;

			if (isNested(e))
				return;
			
			$(operations).each(function(oo,oper) {
				
				if ($(e).attr('sg:'+oper) == undefined)
					return;

				var attrValue = $(e).attr('sg:'+oper);

				if (attrValue == '' || attrValue[0] == '#')
					return;

				var result = handlers[oper](e);

				// "Cap" the attribute so it won't be processed again.
				if (result != false)
					$(e).attr('sg:'+oper, '#'+attrValue);
				
				//return false; // don't return so that we can run multiple operations on a single node, like sg:map+sg:model for instance.
			});
		});
	};

	$.fn.singular.installer = function() { };
}(
	document,
	jQuery,
	window.console || { log: function(m) { } }
);
