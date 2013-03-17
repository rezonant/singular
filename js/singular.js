/**
 * ###########################################
 * ################ SINGULAR #################
 * ###########################################
 *    (C) 2013 William Lahti. MIT LICENSED
 */

!function(document, $, console, undefined) {
	
	/**
	 * Singular's class model comes from:
	 * 
	 *     Simple JavaScript Inheritance
	 *     By John Resig http://ejohn.org/
	 *     MIT Licensed.
	 *     Inspired by base2 and Prototype
	 * 
	 * It is internal to Singular, and is only used by outside code when constructing subclasses of Singular
	 * objects (ie, SingularView.declare).
	 */
	var Class = (function(){
		var initializing = false, fnTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/;
		// The base Class implementation (does nothing)
		var Class = function(){};

		Class.declare = function(name, prop) {
			var klass = this.extend(prop);
			klass.displayName = name;
			window[name] = klass;
		};

		// Create a new Class that inherits from this class
		Class.extend = function(prop) {
			var _super = this.prototype;

			// Instantiate a base class (but only create the instance,
			// don't run the init constructor)
			initializing = true;
			var prototype = new this();
			initializing = false;

			// Copy the properties over onto the new prototype
			for (var name in prop) {
				// Check if we're overwriting an existing function
				prototype[name] = typeof prop[name] == "function" &&
					typeof _super[name] == "function" && fnTest.test(prop[name]) ?
					(function(name, fn){
						return function() {
							var tmp = this._super;

							// Add a new ._super() method that is the same method
							// but on the super-class
							this._super = _super[name];

							// The method only need to be bound temporarily, so we
							// remove it when we're done executing
							var ret = fn.apply(this, arguments);
							this._super = tmp;

							return ret;
						};
					})(name, prop[name]) :
					prop[name];
			}

			// The dummy class constructor
			function Class() {
			  // All construction is actually done in the init method
			  if ( !initializing && this.init )
				this.init.apply(this, arguments);
			}

			// Populate our constructed prototype object
			Class.prototype = prototype;

			// Enforce the constructor to be what we expect
			Class.prototype.constructor = Class;

			// And make this class extendable
			Class.extend = arguments.callee;
			Class.declare = function(name, prop) {
				var klass = this.extend(prop);

				klass.displayName = name;
				window[name] = klass;
			};


			return Class;
		};
		
		return Class;
	})();
	var devMode = false;					// Set to true to enable console.log within this module
	
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

	var tokenize = function(expr, options) {
		var tokens = [], buf = [], withinString = false, stringStart = 0;

		options = $.extend({
			whitespace: true
		}, options);

		for (var i = 0; i < expr.length; ++i) {
			var currentChar = expr[i],
				regexWhitespace = /^\s+$/,			regexIdentifier = /^[A-Za-z_][A-Za-z0-9_]*(\.|\.[A-Za-z_][A-Za-z0-9_]*)*$/,
				regexNumeric	= /^[0-9]+$/,		regexOperators	= /^(&&|\|\||\+\+|--|==|!=|>=|<=|\*=|\/=)$/,
				regexTokens = [ regexWhitespace, regexIdentifier, regexNumeric, regexOperators ];

			if (withinString === false) {
				// Put the buffer and the incoming character together to make a "prospect" to examine.
				var prospect = buf.length > 0 ? buf.join('') + currentChar : currentChar,
					valid = false;

				// Set valid = true if we find a valid token in the prospect
				$(regexTokens).each(function(j, regex) { return !(valid = prospect.match(regex)); });

				// If this doesn't look good, its a token boundary.
				if (!valid && buf.length > 0) {
					var push = true;

					if (!options.whitespace && buf.join('').match(regexWhitespace))
						push = false;

					if (push)
						tokens.push(buf.join(''));
					
					buf = [];
				}
			}

			if (withinString !== false && currentChar == withinString) {
				withinString = false;
			} else if (currentChar == '\'' || currentChar == '"') {
				withinString = currentChar;
				stringStart = i;
			}
			
			buf.push(currentChar);
		}

		if (withinString !== false)
			throw new Error('singular: Parse error: Unterminated string literal started at column '+stringStart);

		if (buf.length > 0)
			tokens.push(buf.join(''));
		
		return tokens;
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
		init: function(model, $attachPoint, $input) {
			this.model = model;
			this.$model = model; // deprecated
			
			if (typeof $attachPoint != 'undefined')
				this.install($($attachPoint), $($input));
		},

		/**
		 * @type jQuery
		 */
		$attachPoint: null,
		
		/**
		 * @type jQuery
		 */
		$input: null,
		
		/**
		 * @type SingularModel
		 */
		model: null,
		$model: null,	// deprecated
		
		loaded: false,
		
		hasLoaded: function() { /* ... */ },
		
		_parentView: null,
		parentView: function() {
			if (this._parentView)
				return this._parentView;
			
			var spot = this.$attachPoint.parent();
			
			while (spot != null && !spot.prop('sgView'))
				spot = spot.parent();
			
			if (!spot)
				return null;
			
			return this._parentView = spot.prop('sgView');
		},
		
		/**
		 * @abstract
		 */
		setup: function($input) {
			// Do something with $attachPoint, $input and model
		},

		install: function($attachPoint, $input) {
			var toCamelCase = function(str) {
				var newStr = '';
				var capitalize = false;
				
				for (var i = 0, max = str.length; i < max; ++i) {
					var ch = str[i];
					if (ch == '-') {
						capitalize = true;
						continue;
					}
					
					if (capitalize)
						ch = ch.toUpperCase();
					newStr += ch;
					
					capitalize = false;
				}
				
				return newStr;
			};
			
			var self = this;
			this.$attachPoint = $attachPoint;
			this.$input = $input;
			
			$($attachPoint)[0].sgView = this;
			
			$($($attachPoint).prop('attributes')).each(function(i,attr) {
				if (!attr.name.match(/data-.*/))
					return;
				
				var paramName = attr.name.substr('data-'.length);
				var paramValue = attr.value;
				
				if (!isNaN(parseFloat(paramValue))) {
					paramValue = parseFloat(paramValue);
				}
				
				self.$model.set('params.'+toCamelCase(paramName), paramValue);
			});
			
			this.setup($input);
		}
	});

	SingularView.local = {
		viewBlueprintContainer: '.singular-views',
		pageBlueprintContainer: '.singular-pages',
		
		folderForView: function(name) { return 'views'; },
		folderForPage: function(name) { return 'pages'; },
		error: function(err) {
			window.console.log('An error occurred loading a Singular view: ');
			window.console.log(err);
			alert('An error occurred loading a Singular view.');
		}
	};
	
	SingularView.require = function(name, callback) {
		if (!SingularView.require.status)
			SingularView.require.status = {};
		
		var status = SingularView.require.status;
		
		if (window[name]) {
			if (typeof callback != 'undefined') {
				callback(true);
			}
			return 'already-present';
		}
		
		if (status[name]) {
			// Another request is active to load this widget.
			
			var chain = status[name];
			status[name] = function() {
				chain();
				callback(false);
			}
			
			return;
		}
		
		console.log('singular: View is required ('+name+'), fetching... ***');
		status[name] = function() { };
		
		var folder = SingularView.local.folderForView(name);
		var done = 0;
		
		var meat = function() {
			if (++done < 2)
				return;
			
			if (typeof callback != 'undefined') {
				console.log('singular: Required view '+name+' has been loaded. ***');
				status[name] ();
				delete status[name];
				callback(false);
			}
		}
		
		$.ajax(folder+'/'+name+'.js', {
			cache: true,
			dataType: 'text',
			type: 'GET', 
			
			complete: function(xhr) {
				var r = xhr.responseText;
				$('body').append($('<script />', {type: 'text/javascript'}).html('//@ sourceURL='+folder+'/'+name+'.js\n'+r));
				meat();
			},
			error: function(err) {
				SingularView.local.error(err);
			}
		});
			
		$.ajax(folder+'/'+name+'.html', {
			cache: true,
			dataType: 'text', 
			type: 'GET',
			
			complete: function(xhr) {
				var r = xhr.responseText;
				$(SingularView.local.viewBlueprintContainer).append($('<div />', {id: 'view-'+name}).html(r));
				meat();
			},
					
			error: function(err) {
				SingularView.local.error(err);
			}
		});
			
		console.log('singular: All tasks launched.');
		return 'loading';
	}

	SingularInspector = SingularView.extend({
		setup: function() {
			var self = this;
			var ap = $(this.$attachPoint);
			
			this.$hider = ap.find('.hider');
		},

		hasLoaded: function() {
			var self = this;
			this.$hider.find('a.hideInspector').click(function(ev) {
				self.hide();
			});
			
			this.$attachPoint.css('z-index', '1000000000000');	// oh yeah, baby, layout killah.
		},
	
		$hider: null,

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
			$('body').append($('<div id="view-SingularInspector" class="sgInspector sgTemplate" sg:use="sgInspector">'+
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
			console.log('lookup changed to '+value);
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

			console.log('inspector change value for '+name+' to value '+value);
			ignoreChange = true;
			$appModel.set(name, value);
			ignoreChange = false;
		}, false);
	};


	$appModel = null;

	SingularModel = Class.extend({
		init: function(parent, namespace) {

			this.subWatches = {};
			
			if (typeof parent == 'undefined')
				parent = $appModel;

			if (typeof namespace == 'undefined')
				namespace = '$';

			this.parent = parent;

			while (namespace.indexOf('.') === 0 && namespace.length > 0)
				namespace = namespace.substr(1);

			while (namespace.lastIndexOf('.') === namespace.length - 1 && namespace.length > 0)
				namespace = namespace.substr(0, namespace.length - 1);

			this.parentPrefix = namespace;
			this.forwardChanges = (this.parent != null);

			this.watchers = {};
			this.attributes = {};
			this.anyWatchers = [];
			
			if (this.parent === null) {
				this.attributes.singular = {
					version: '0.2.0',
					versionCode: 002000,
				};
			}
			
			var self = this;
			
			if (this.parent) {
				console.log('singular: (+) Subwatch: '+this.parent.where(this.parentPrefix));
				this.parent.subWatch(this.parentPrefix, function(name, value, oldValue) {
					if (self.ignoreParentWatcher)
						return;
					
					var originalName = name;
					
					if (name.indexOf(self.parentPrefix) == 0)
						name = name.substr(self.parentPrefix.length);
					else
						name = '.'+name;
					
					if (name[0] == '[')
						name = '$'+name;
					else if (name[0] == '.')
						name = name.substr(1);
					else
						throw "Syntax error: subproperty "+originalName+" is not well formed.";
					
					console.log('singular: (!) Subwatch: '+self.where(name)+' = \''+value+'\'');
					
					self._setLocal(name, value);
					self._fireResponders(name, value, oldValue, false, false);
				});
			}
		},

		ignoreParentWatcher: false,
		
		statistics: function() {
			var stats = {
				watcherCount: 0,
				anyWatcherCount: this.anyWatchers.length,
				uniqueWatchCount: 0,
				watchedProperties: [],
				averageWatchersPerProperty: 0
			};
			
			for (var name in this.watchers) {
				stats.watcherCount += this.watchers[name].length;
				stats.averageWatchersPerProperty = (stats.averageWatchersPerProperty*stats.uniqueWatchCount + this.watchers[name].length) / (stats.uniqueWatchCount+1);
				stats.uniqueWatchCount += 1;
				stats.watchedProperties.push(name);
			}
			
			return stats;
		},

		where: function(name) {
			if (typeof name != 'undefined') {
				var part = '';
				
				if (this.parent)
					part += this.parent.where()+' @ ';
				else
					part += '$appModel @ ';
				
				if (this.parent && this.parentPrefix)
					part += this.parentPrefix + ' | ';
				
				part += name;
				return part;
			}
			
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
			if (namespace == '$')
				return this;
			
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
		
		/**
		 * Sets a model attribute, but only if it has not already been set.
		 * 
		 * @param string name
		 * @param mixed value
		 * @returns bool True if the value was set, false if it was set previously.
		 */		
		initialize: function(name, value) {
			if (this.get(name) === undefined) {
				this.set(name, value);
				return true;
			}
			
			return false;
		},

		/**
		 * Get the local (this model only) value of the given attribute
		 * @param {type} name
		 * @param {type} defaultValue
		 * @returns {undefined}
		 */
		getLocal: function(name, defaultValue)
		{
			name = this.getCanonicalPath(name);
			
			if (this.parent)
				return this.parent.getLocal(this.parentPrefix+"."+name, defaultValue);
			
			if (typeof name == 'undefined')
				return defaultValue;
			
			if (name == '$')
				return this.attributes;
			
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

			var previous = null;
			while (current != null && index < path.length) {
				var component = path[index];

				if (component == '') {
					++index;
					continue;
				}

				var execute = false;
				var argList = null;

				if (component.lastIndexOf(')') == component.length - 1) {
					// Function call
					execute = true;
					argList = []


					var args = component.substr(component.indexOf('(') + 1);
					args = args.substr(0, args.length - 1);
					console.log('wtf');
					var tokens = tokenize(args);
					var argBuf = [];

					console.log('exec func call');
					!function() {
						// Prepare the expected environment for eval()

						var self = current;
						console.log('looks like: '+argBuf.join('').replace(/%/, 'self'));
						$(tokens).each(function(i,token) {
							if (token == ',') {
								argList.push(eval(argBuf.join('').replace(/%/, 'self')));
								argBuf = [];
							} else {
								argBuf.push(token);
							}
						});

						if (argBuf.length > 0)
							argList.push(eval(argBuf.join('').replace(/%/, 'self')));
					}();
					console.log('function args');
					console.log(argList);

					// Remove the args
					component = component.substr(0, component.lastIndexOf('('));
				}

				if (component.charAt(0) == '[') {
					var sub = parseInt(component.substr(1, component.length - 2));
					previous = current;
					current = current[sub];
					++index;
					continue;
				}

				if (component == '@') {
					previous = current;
					current = this.where()+'.'+path.slice(0, index).join('.');
					++index;
				} else if (current[component]) {
					previous = current;
					current = current[component];
					++index;
				} else {
					previous = current;
					current = null;
					break;
				}

				// Execute

				if (execute) {
					console.log('**EXPERIMENTAL: get() function execute');
					current = current.apply(previous, argList);
				}
			}

			if (current !== null)
				return current;
			
			return defaultValue;
		},
		
		parseFilters: function(attr)
		{
			var name = null;
			var filters = {};
			var filter = function(value) { return value; };
			
			$(attr.split('|')).each(function(i,component) {
				component = component.trim();
				
				if (name === null) {
					name = component;
				} else {
					filters.push(component);
					var previousFilter = filter;
					filter = function(value) {
						var input = previousFilter(value);
						
					}
				}
			});

			return {
				name: name,
				filters: filters,
				filter: filter
			};
			
			var availableFilters = {
				shorten: function(input, param) {
					var max = parseInt(param);
					if (input.length > max)
						return input.substr(0, max - 3)+'...';

					return input;
				}
			};

			var applyFilters = function(input, filters) {
				var output = input;

				for (var name in filters) {
					var value = filters[key];

					if (!availableFilters[name])
						continue; // skip the filter (TODO: error...)

					var func = availableFilters[name];
					output = func(output, value);
				}

				return output;
			};
	
		},
		
		get: function(name, defaultValue) 
		{
			if (typeof name == 'undefined')
				return defaultValue;

			if (name == '$') {
				if (this.parent && this.parentPrefix) {
					return this.parent.get(this.parentPrefix, defaultValue);
				} else {
					return this.attributes;
				}
			}

			name = this.getCanonicalPath(name);
			
			var value = this.getLocal(name);
			if (value !== undefined)
				return value;
			
			if (this.parent != null) {
				var v;

				if (this.parentPrefix != '') {
					v = this.parent.get(this.parentPrefix+'.'+name);

					if (v !== undefined) {
						return v;
					}
				}

				v = this.parent.get(name);
				
				if (v !== undefined)
					return v;
			}
			
			return defaultValue;
		},

		evaluate: function(expr) {

			var dependencies = [];
			var self = this;

			var resolve = function(t) {
				var not = false;
				var value;
				
				if (t[0] == '!') {
					not = true;
					t = t.substr(1);
				}
				
				if (t[0] == '\'') {
					value = t.substr(1, t.length-2);
				} else if (!isNaN(t)) {
					value = parseFloat(t);
				} else {
					if ($.inArray(t, dependencies) < 0)
						dependencies.push(t);
					value = self.get(t);
				}

				
				
				if (not)
					value = !value;
				
				if (typeof value == 'undefined')
					value = '';

				return value;
			};

			var tokens = tokenize(expr, {whitespace:false});
			var truth = false;
			var evaluator;
			var map = {};
 
			// Simplify tokens (!<tok> becomes <!tok>, indexes and dots are combined)
			
			var newTokens = []; 
			for (var i = 0, max = tokens.length; i < max; ++i) {
				var tok = tokens[i];
				
				if (tok == '!' && i + 1 < max) {
					newTokens.push(tok+tokens[i+1]);
					++i;
				} else {
					if (/^[A-Za-z0-9]+$/.test(tok)) {
						while (i + 1 < max) {
							console.log('loopaging');
							var next = tokens[i + 1];
							if (next == '.' || next == '[' || next == ']' || /^[A-Za-z0-9]+$/.test(next)) {
								++i;
								tok += next;
								continue;
							}
							
							break;
						}
					}
					newTokens.push(tok);
				}
			}
			tokens = newTokens;

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
					'<=': function(a,b) { return a <= b; },
					'||': function(a,b) { return a || b; },
					'&&': function(a,b) { return a && b; }
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

			var oldName = name;
			name = this.getCanonicalPath(name);

			if (!this.watchers[name])
				this.watchers[name] = [];

			if (immediate)
				responder(this.get(name));

			console.log('singular: (+) Watcher: '+this.where(name)+' (count: '+(this.watchers[name].length+1)+')');
			this.watchers[name].push(responder);

			// Check for changes to this property initiated within a parent model
			
			if (name == '$' && this.forwardChanges && this.parent) {
				console.log('singular: (+) $ Parent Watcher: '+this.parentPrefix);
				this.parent.watch(this.parentPrefix, function(value) {
					console.log('singular: (!) Parent Watcher: '+self.where()+' = '+value);
					responder(value);
				}, false);
			}
		},

		getChildWatchers: function(name) {
			var list = [];
			for (var field in this.watchers) {
				if (field.indexOf(name+'.') === 0 || field.indexOf(name+'[') === 0) {
					var items = this.watchers[field];
					list.push({field:field, items:items});
				} else if (name.indexOf(field+'.') === 0 || name.indexOf(field+'[') === 0) {
					var items = this.watchers[field];
					list.push({field:field, items:items});
				}
			}
			
			return list;
		},
		
		subWatches: null,
		
		subWatch: function(prop, callback) {
			prop = this.getCanonicalPath(prop);
			
			if (!this.subWatches[prop])
				this.subWatches[prop] = [];
			
			this.subWatches[prop].push(callback);
		},
		
		_fireResponders: function(name, value, oldValue, traverseParents, traverseChildren, runSubwatchers) 
		{
			var self = this;
			
			// _fireResponders can end up calling recursive set() methods to keep everybody in sync. 
			// The stack can easily be exceeded going this deep. So we delay for a second, which kills the stack.
	
			if (true) {	// Uncomment me if you need good stack traces
				self._fireRespondersMeat(name, value, oldValue, traverseParents, traverseChildren, runSubwatchers);
				return;
			}
			
			setTimeout(function() {
				self._fireRespondersMeat(name, value, oldValue, traverseParents, traverseChildren, runSubwatchers);
			}, 0);
		},
				
		_prefix: function() {
			if (this.parentPrefix != '')
				return this.parentPrefix+'.';
			return '';
		},
				
		_fireRespondersMeat: function(name, value, oldValue, traverseParents, traverseChildren, runSubwatchers) 
		{
			name = this.getCanonicalPath(name);
			
			if (typeof traverseParents == 'undefined')
				traverseParents = true;
			if (typeof traverseChildren == 'undefined')
				traverseChildren = true;
			if (typeof runSubwatchers == 'undefined')
				runSubwatchers = true;
		
			var self = this;
			
			// Notify watchers on all parents

			if (false && traverseParents && name.indexOf('.') >= 0) {
				var rent = name.substr(0, name.lastIndexOf('.'));
				var rentVal = this.get(rent);
				this._fireResponders(rent, rentVal, rentVal, true, false);
			}

			// Notify watchers on all children

			if (false && traverseChildren) {
				$(this.getChildWatchers(name)).each(function(i,subWatcher) {
					var value = self.get(subWatcher.field);
					$(subWatcher.items).each(function(j, callback) {
						callback(value);
					});
				});
			}
			
			// Notify watchers on deleted properties of children

			if (value != null && oldValue != null && typeof oldValue == 'object' && typeof value == 'object') {
				for (var key in oldValue) {
					if (!value[key]) {
						this._fireResponders(name+'.'+key, undefined, oldValue[key]);
					}
				}
			}

			// Notify any subwatchers (watchers on all subproperties).
			
			if (runSubwatchers) {
				var subs = (name.replace(/\.\$/, '').replace(/([^\$])\[/g, '$1.[')).split('.');
				var last = null;
				var skipArray = false;
				
				for (var j = subs.length - 1; j >= 0; --j) {
					var sub;

					if (j > 0)
						sub = subs.slice(0, j).join('.');
					else
						sub = '$';
					
					if (last && last[0] == '[' && !skipArray) {
						sub += last;
					}
					
					if (this.subWatches[sub]) {
						console.log('singular: (!) Executing subwatchers for '+sub+'  ('+this.where()+')');
						$(this.subWatches[sub]).each(function(si,subWatcher) {
							subWatcher(name, value, oldValue);
						});
					}
					
					if (last && last[0] == '[') {
						skipArray =! skipArray;
						if (skipArray) {
							++j;
							continue;
						}
					}
					
					if (j > 0)
						last = subs[j-1];
					else
						last = '$';
				}
			}
			
			if (this.forwardChanges && traverseParents) {
				console.log('singular: (!) Forwarding: '+this.parentPrefix+'.'+name);
				this.parent._setLocal(this._prefix()+name, value);
				
				this.ignoreParentWatcher = true;
				this.parent._fireResponders(this._prefix()+name, value, oldValue, true, true, true);
				this.ignoreParentWatcher = false;
			}
			
			// Notify on this property
			
			if (!this.watchers[name])
				return;

			console.log('singular: (!) Fire: '+name+' = \''+value+'\' (was: \''+oldValue+'\')');
			// If we aren't already doing so, fire any handlers attached to the identity for this property.
			if (false && name.lastIndexOf('$') !== name.length - 1) {
				console.log('singular: (!) Fire Identity ('+name+'.$)');
				this._fireResponders(name+'.$', value, oldValue, false, false);
			}

			if (typeof oldValue == 'undefined')
				oldValue = null;

			$(this.anyWatchers).each(function(i,e) {
				console.log('singular: (!) Anywatcher: '+name+' = '+value+' (was: '+oldValue+', model: '+self.where()+')');
				e(name, value, oldValue);
			});

			$(this.watchers[name]).each(function(i,e) {
				console.log('singular: (!) '+name+' = '+value+' (was: '+oldValue+', model: '+self.where()+')');
				e(value);
			});
		},

		getCanonicalPath: function(name)
		{
			// .$ and $. are like the current directory in filesystems...
			return (''+name).replace(/\.\$/, '').replace(/^\$\./, '');
		},
				
		_setLocal: function(name, value)
		{
			if (this.parent)
				return this.parent._setLocal(this.parentPrefix+'.'+name, value);
			
			if (false && typeof value == 'object' && !(value instanceof Array)) {
				for (var key in value) {
					if (key == 'self') {
						this.set(name, value[key]);
						continue;
					}

					this.set(name+'.'+key, value[key]);
				}
				return;
			}
			
			var oldValue = null;

			if (name.indexOf('.') >= 0) {

				// Retrieve the object of the final attribute
				var rent = name.substr(0, name.lastIndexOf('.'));
				var leaf = name.substr(name.lastIndexOf('.')+1);
				var rentObj = this.getLocal(rent);

				if (rentObj === undefined) {
					rentObj = {};
					this._setLocal(rent, rentObj);
				}

				if (leaf.match(/.*\[.*\]/)) {
					var param = leaf.substr(0, leaf.indexOf('['));
					var sub = leaf.substr(leaf.indexOf('[')+1);
					sub = parseInt(sub.substr(0, sub.length - 1));

					var partial;

					if (param == '$')
						partial = rentObj;
					else
						partial = rentObj[param];

					if (!partial) {
						rentObj[param] = partial = [];
					}
					
					oldValue = partial[sub];
					partial[sub] = value;
				} else {
					if (typeof rentObj[leaf] != 'undefined')
						oldValue = rentObj[leaf];

					rentObj[leaf] = value;
				}

			} else {
				if (name.match(/.*\[.*\]/)) {
					var param = name.substr(0, name.indexOf('['));
					var sub = name.substr(name.indexOf('[')+1);
					sub = parseInt(sub.substr(0, sub.length - 1));

					if (!this.attributes[param])
						this.attributes[param] = [];

					this.attributes[param][sub] = value;
				} else {
					if (this.attributes[name])
						oldValue = this.attributes[name];

					this.attributes[name] = value;
				}
			}
		},
				
		set: function(name, value) 
		{
			// Bonus mode: Set lots of properties at once!
			
			if (typeof name == 'object' && typeof value == 'undefined') {
				for (var key in name)
					this.set(key, name[key]);
				return;
			}
			
			name = this.getCanonicalPath(name);
			
			// .$ means nothing to us.
			
			name = (''+name).replace(/\.\$$/, '');
			if (typeof name == 'undefined')
				return false;

			if (name == '$') {
				this.attributes = value;
				return;
			}

			var oldValue = undefined;
			
			if (typeof value == 'undefined') {
				value = this.get(name); // trigger a change without a change
			} else {
				// don't trigger changes if there is no change
				// But always run for objects/arrays

				oldValue = this.get(name);

				if (typeof value != 'object' && oldValue == value)
					return;
			}

			this._setLocal(name, value);
			
			if (false && this.forwardChanges && this.parent != null) {
				this.parent._setLocal(this._prefix()+name, value);
				this.parent._fireResponders(this._prefix()+name, value, oldValue, true, false, false);
				//this.parent.set(this._prefix()+name, value);
			}

			this._fireResponders(name, value, oldValue);
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
		var nodes = $('<div />', {"sg:view":"SingularInspector"});
		$('body').append(nodes);
		$(nodes).singular();

		return nodes.get(0).sgView;
	};

	/////////////////////////////////////////////////////////////////////////
	/////////// $.fn.singular

	$.fn.singular = function($model, originalOptions)
	{
		//setTimeout(function() {
			$.fn.singularMeat.apply(this, [$model, originalOptions || {}]);
		//}, 0);
		
		return this;
	};
	
	$.fn.singularMeat = function($model, originalOptions)
	{
		// Utilities ----------------------------------------------------------
		
		//function 
		
		// --------------------------------------------------------------------
		
		var options = $.extend({
			runInstaller: true,
			completed: function() { }
		}, originalOptions || {});
		
		options.context = this;

		// The installer code should run after ALL singular stuff is done, 
		// including asynchronous requests for markup / classes. 
		// The request.wait() / request.finished() mechanism lets various
		// parts of Singular notify the core that the installer should be delayed
		// due to ongoing asynchronous requests. Simply call request.wait() before
		// you initiate the request, and call request.finished() when you are completely
		// finished with the request.
		
		var requestsWaiting = 1;
		var totalRequests = 1;
		var requestsDone = false;
		
		var request = {
			wait: function() {
				++requestsWaiting;
				++totalRequests;
				//if (!requestsDone)
				//	console.log(requestsWaiting+' requests are in progress (and blocking singular completion)  [+1]');
			},

			finished: function() {
				--requestsWaiting;
				if (requestsDone)
					return;

				if (requestsWaiting <= 0) {
					requestsDone = true;
					//console.log('all requests have completed ('+totalRequests+' total), running installer, calling completed()');
					if (options.runInstaller)
						$.fn.singular.installer(options.context);

					options.completed();
				} else {
					//console.log(requestsWaiting+' requests are in progress (and blocking singular completion)  [-1]');	
				}
			}
		};
		
		if (typeof $model == 'undefined')
			$model = $appModel;

		if (!($model instanceof SingularModel)) {
			var data = $model;
			$model = new SingularModel($appModel);
			$model.attributes = data || {};
		}


		/**
		 * Find all usages of all registered operations and
		 * run their designated handlers. This is how sg:xxx
		 * attributes are mapped to handlers.xxx above.
		 */
		var attrList = [];
		var operations = [];
		var sources = null;
		for (var oper in $.fn.singular.handlers) {
			attrList.push('[sg\\:'+oper+']');
			operations.push(oper);
		}
		attrList = attrList.join(', ');
		$.fn.singular.attributeList = attrList;

		console.log('singular: Scanning.');
		sources = $(this).find(attrList).add($(this).filter(attrList)).not('[sg\\:ignore]').not('.sgTemplate');
		
		// Mark all nodes as "sg-processing" so that we can discern which constructs have finished processing and which haven't
		// (finished constructs have "sg-ready" and all constructs have "sg-construct")
		
		console.log('singular: Processing.');
		sources.each(function(i,e) {
			
			var sgIgnore = $(e).parents('[sg\\:ignore]:first');

			if (sgIgnore.length > 0)
				return false; // All operations on this 

			$(e).data('sg-processed', false);
			$(e).addClass('sg-construct').addClass('sg-processing');
		});
		
		sources.each(function(i,e) {
			if ($(e).attr('sg:ignore') !== undefined)
				return;

			if (isNested(e))
				return;

			var sgIgnore = $(e).parents('[sg\\:ignore]:first');

			if (sgIgnore.length > 0)
				return false; // All operations on this 

			var nearestParent = $(e).parents('.sg-processing:first');

			// There once was an experimental change here that iterated over the attributes first, 
			// checking the operations array using indexOf(). This was so much slower, and the implementation
			// did not take into account the intended processing order of the operations listed.
			// The only way through was to introduce slower code to fix the correctness issue, so I abandoned it.

			$(operations).each(function(oo,oper) {
				if (typeof $(e).attr('sg:'+oper) == 'undefined')
					return;

				console.log('singular: (!) Operation '+oper);
				var attrValue = $(e).attr('sg:'+oper);

				if (!attrValue || attrValue[0] == '#')
					return;

				function process() {
					var result = $.fn.singular.handlers[oper](e, $model, options, request);

					// Mark the widget as sg-ready and remove sg-processing
					
					$(e).addClass('sg-ready').removeClass('sg-processing');

					// "Cap" the attribute so it won't ever be processed again.
					
					if (result != false)
						$(e).attr('sg:'+oper, '#'+attrValue);
					
					// Process any subordinate constructs which have been waiting for this construct to be processed...
					
					var waiters = $(e).attr('sg-waiting');
					
					if (waiters !== undefined) {
						console.log('Processing '+waiters.length+' waiters on <sg:'+oper+'>');
						$(waiters).each(function(i,waiter) {
							waiter();
						});
					}
				}
				
				if (nearestParent.length) {
					// Delay our processing until the parent is finished loading
					if (typeof nearestParent.data('sg-waiting') == 'undefined')
						nearestParent.data('sg-waiting', []);
					var waiters = nearestParent.data('sg-waiting');
					
					console.log('(~~) Waiting with '+waiters.length+' others on:');
					console.log(nearestParent);
					
					$(e).addClass('sg-waiting');
					waiters.push(function() {
						$(e).removeClass('sg-waiting');
						console.log('(!!) Finally! Nearest parent has completed processing! Now executing '+oper);
						process();
					});
					nearestParent.data('sg-waiting', waiters);
				} else {
					// All parents are already processed. Immediately process this construct...
					process();
				}
				
			});
		});

		request.finished();
		return this;
	};

	/**
	 * Singular Handlers
	 * Each member of the handlers object defined below is a callback
	 * that is invoked when an attribute of the same name as the handlers
	 * member, except prefixed with 'sg:'. IE, handlers.each is called when
	 * sg:each is spotted in the document.
	 * 
	 * In this way, Singular is immediately extensible, just as jQuery is.
	 * Any script may install a Singular markup attribute,
	 */

	$.fn.singular.handlers = {};

	$.fn.singular.handlers.view = function(e, $model, options, request) {
		e = $(e);

		var type = $(e).attr('sg:view');
		$(e).attr('sg:view', '#'+type);

		if ($(e).attr('sg:each') !== undefined)
			return false;	// each does it's own sg:view handling

		var $subModel = $model;

		if (false && $(e).attr('sg:model') !== undefined) {
			$subModel = $model.use($(e).attr('sg:model'));
		}

		$(e).addClass('sg-loading');
		$(e).hide();
		

//			$(e).sgView(type, $subModel, {runInstaller:false});

		// If the view class has a static install(), run it.
		// It can do things like prepare the '#-ViewClassHere'
		// element which should contain the markup for this class.

		if (window[type] && window[type].install && !window[type].installed) {
			window[type].install();
			window[type].installed = true;
		}

		var children = $(e).children().remove()
		var inputNodes = children.clone();

		// Disable all sg: attributes on the original children set
		var silenceChild = function(ci,ch) {
			$(ch.attributes).each(function(ai,attr) {
				if ((attr.value.length == 0 || attr.value[0] != '#') 
						&& attr.name.indexOf('sg:') == 0)
					$(ch).attr(attr.name, '#'+attr.value);
			});
		};
		$(children).filter($.fn.singular.attributeList).each(silenceChild);
		$(children).find($.fn.singular.attributeList).each(silenceChild);

		request.wait();
		SingularView.require(type, function(inline) {

			// Install said #view-ClassHere markup if we find it.

			if ($('#view-'+type).length != 0) {
				var chunk = $('#view-'+type).contents().clone();
				$(e).append(chunk);

				$($('#view-'+type).get(0).attributes).each(function(i,attr) {
					if (attr.name == 'id' || attr.name == 'class') 
						return;

					$(e).attr(attr.name, attr.value);
				});
				
				$($('#view-'+type).get(0).classList).each(function(i,klass) {
					$(e).addClass(klass);
				});
				

				$(e).removeClass('sgTemplate');
			}

			// Prepare to run Singular on the whole shebang
			// We'll use our parent context unless sg:model is
			// present, if so we'll build a submodel.
			// Don't forget to calculate the sg:use chain.

			var prefix = calculateUsePrefix(e);
			var $subModel = $model;

			//if (prefix != '')
			//	$subModel = $model.use(prefix);

			if ($(e).attr('sg:model')) {
				$subModel = $model.use($(e).attr('sg:model'));
				$subModel.meta = {
					source: 'sg:view',
					viewName: type,
					context: this
				};
			}

			// Construct the view instance and attach it to the DOM element.
			
			var view = null;
			if (!window[type]) {
				console.log('singular: Error: could not locate view class '+type);
			} else {
				var klass = window[type];
				view = new klass($subModel, e.get(0), inputNodes);
				e.prop('sgView', view);
			}

			// The installer should always be run from the top-level Singular (ie, the one we are in or a parent)
			// and never the child.
			
			var suboptions = $.extend({}, options, {
				runInstaller: false,
				completed:function() { 
					$(e).removeClass('sg-loading');
					if (view != null)
						view.hasLoaded();
					$(e).show();

					request.finished();
				}
			});
			
			// If async has occurred, run the installer
			if (false && !inline) {
				suboptions.runInstaller = true;
			}

			$(e).removeClass('sg-processing'); // leaving this on means none of your subviews will be attached.
			//
			// Run Singular on the new view markup. Good luck little baby views!
			$(e).children().singular($subModel, suboptions);





		});

	};

	$.fn.singular.handlers.each = function(e, $model, options, request) {
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
			$(e).html('');

			if (typeof value == 'undefined')
				return;
			
			if (!$.isArray(value)) {
				debugger;
				throw "sg:each may only be used on properties containing arrays.";
			}
			
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
				var $subModel = $model.use(prefix+prop+'['+i+']');

				$subModel.meta = {
					source: 'sg:each',
					index: i,
					item: item,
					context: instance[0]
				};

				$subModel.watchAny(function(key, value) {
					// Trigger a "change" on the "eached" property
					//$model.set(prefix+prop+'['+i+']');
				});

				$subModel.attributes = item;
				request.wait();

				$(container).singular($subModel, {runInstaller: false, completed: function() { request.finished(); }});
				$(container).find('> *').detach();
				$(e).append(instance);
			});
		});
	};

	$.fn.singular.handlers.map = function(e, $model, options, request) {
		var map = $(e).attr('sg:map').split(';');

		var autoMap = (function() {
			var returnSet = [];
			$($(e).prop('attributes')).each(function(i,attrib) {
				if (attrib.name.indexOf('sg:') === 0)
					return;

				var name	= attrib.name,
					value	= attrib.value,
					brace	= false,		buf = [],
					attr	= false,		endr = false,
					attrBuf = null;

				if (value.indexOf('{{') < 0)
					return;

				for (var x = 0; x < value.length; ++x) {
					var currentChar = value[x];

					if (endr) {
						if (currentChar == '}') {
							// flush that shit
							var attrName = attrBuf.join('');
							attrBuf = [];
							buf.push({type:'dynamic', value:attrName, rendering:$model.get(attrName)});
							endr = false;
							continue;
						}
					} else if (attr) {
						if (currentChar == '}') {
							endr = true;
							attr = false;
							continue;
						} else {
							attrBuf.push(currentChar);
							continue;
						}
					} else if (brace) {
						if (currentChar == '{') {
							attr = true;
							attrBuf = [];
							brace = false;
							continue;
						}
					} else {
						if (currentChar == '{') {
							brace = true;
							continue;
						} else {
							brace = false;
						}
					}

					buf.push({type:'static', value:currentChar});
				}

				returnSet.push({
					name: attrib.name,
					events: buf
				});
			});

			return returnSet;
		})();

		if (autoMap.length > 0) {
			console.log('singular: Automap:');
			console.log(autoMap);
		}

		$(autoMap).each(function(i,attributeContents) {
			var deps = [];

			$(attributeContents.events).each(function(i,event) {
				if (event.type != 'dynamic')
					return;

				deps.push(event.value);
			});

			var renderAttributes = function() {
				var contents = '';
				$(attributeContents.events).each(function(i,event) {
					if (event.type == 'static')
						contents += event.value;
					else {
						var defaultValue = devMode? 'missing:'+event.value : '';
						contents += ($model.get(event.value) || defaultValue);
					}
				});

				$(e).attr(attributeContents.name, contents);
			};

			renderAttributes();
			$(deps).each(function(i,dep) {
				$model.watch(dep, function(value) {
					renderAttributes();
				}, false);
			});

		});

		$(map).each(function(i,pair) {
			if (pair == 'auto')
				return;
			var kv = pair.split(':', 2);
			var attrName = kv[0], modelName = kv.length > 1 ? kv[1] : '';
			var prefix = calculateUsePrefix(e, $model);
			if (attrName == '' || modelName == '')
				return;

			$model.watch(prefix+modelName, function(value) {
				console.log('singular: Setting '+prefix+attrName+' to '+value+' on '+$model.where());
				$(e).attr(attrName, value);
			});
		});
	};

	$.fn.singular.handlers.visible = function(e, $model, options, request) {
		var expr = $(e).attr('sg:visible');
		var transition = 'plain';

		if ($(e).attr('sg:transition') !== undefined)
			transition = $(e).attr('sg:transition');

		$model.watchExpr(expr, function(value) {
			if (value) {
				if (transition == 'slide')
					$(e).slideDown();
				else if (transition == 'fade')
					$(e).fadeIn();
				else
					$(e).show();
			} else {
				if (transition == 'slide')
					$(e).slideUp();
				else if (transition == 'fade')
					$(e).fadeOut();
				else
					$(e).hide();
			}
		});
	};

	$.fn.singular.handlers.selected = function(e, $model, options, request) {
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

	$.fn.singular.handlers.checked = function(e, $model, options, request) {
		var expr = $(e).attr('sg:checked');

		$model.watchExpr(expr, function(value) {
			if (value) {
				$(e).prop('checked', true);
			} else {
				$(e).prop('checked', false);
			}
		});
	};

	$.fn.singular.handlers.disabled = function(e, $model, options, request) {
		var expr = $(e).attr('sg:disabled');

		$model.watchExpr(expr, function(value) {
			if (value) {
				$(e).prop('disabled', true);
			} else {
				$(e).prop('disabled', false);
			}
		});
	};

	$.fn.singular.handlers.click = function(e, $model, options, request) {
		var handler = $(e).attr('sg:click');
		$(e).click(function() { eval(handler); });
	};
	
	$.fn.singular.handlers.model = function(e, $model, options, request) {

		if ($(e).attr('sg:view'))
			return false;		// view does its own sg:model handling

		var prefix = calculateUsePrefix(e, $model);
		var attr = $(e).attr('sg:model');
		var value = $model.get(prefix+attr);
		var ignoreChange = false;
		var mode = $(e).attr('sg:mode') || 'instant';
		var filters = {};
		var filterString = $(e).attr('sg:filter');
		var noWrite = false;
		var filterCount = 0;

		if (devMode)
			$(e).attr('sg:dbg-where', $model.where());

		if (typeof filterString == 'string') {
			$(filterString.split(';')).each(function(i,chunk) { var chunks = chunk.split(':'); filters[chunks[0]] = chunks[1]; ++filterCount; } );
		}

		var availableFilters = {
			shorten: function(input, param) {
				var max = parseInt(param);
				if (input.length > max)
					return input.substr(0, max - 3)+'...';

				return input;
			}
		};

		var applyFilters = function(input, filters) {
			var output = input;

			for (var name in filters) {
				var value = filters[key];

				if (!availableFilters[name])
					continue; // skip the filter (TODO: error...)

				var func = availableFilters[name];
				output = func(output, value);
			}

			return output;
		};

		// Writes are not supported when filters are active.

		if (filterCount > 0) {
			noWrite = true;
		}

		// Set up the user input part..
		// Only do this if noWrite hasn't been set above for some reason.
		// mode should be 'blur' to indicate non-instant change tracking

		if (!noWrite) {
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
		}

		// Pick an update function which will respond to changes in the model being watched

		var updateFunc;
		if (e.nodeName == 'INPUT' || e.nodeName == 'TEXTAREA')
			updateFunc = function(value) { 
				$(e).val(applyFilters(value)); 
			};
		else
			updateFunc = function(value) { 
				if (devMode && typeof value == 'undefined')
					value = 'missing:'+prefix+attr;
				
				$(e).html(applyFilters(value)); 
			};

		// And apply it.

		$model.watch(prefix+attr, function(value) {
			if (ignoreChange) 
				return;
			updateFunc(value);
			//$.fn.singular.installer($(e));
		});
	};


	$.fn.singular.installer = function() { };
}(
	document,
	jQuery,
	window.console || { log: function(m) { } }
);
