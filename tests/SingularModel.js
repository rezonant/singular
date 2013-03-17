


describe("SingularModel", function() {
	it("can get the value of a simple attribute name.", function() {
		var model = new SingularModel(null);
		model.attributes.foo = 123;
		expect(model.get('foo')).toBe(123);
	});
	
	it("can set the value of a simple attribute name.", function() {
		var model = new SingularModel(null);
		model.attributes.foo = 0;
		model.set('foo', 123);
		expect(model.attributes.foo).toBe(123);
	});
	
	it("has an initialize() method which sets the value of an attribute name but only when it is not already set.", function() {
		var model = new SingularModel(null);
		model.attributes.foo = 0;
		model.initialize('foo', 123);
		expect(model.attributes.foo).toBe(0);
		
		var model = new SingularModel(null);
		model.initialize('foo', 123);
		expect(model.attributes.foo).toBe(123);
	});
	
	it("can access properties of primitives from the attribute path.", function() {
		var model = new SingularModel(null);
		var str = "Hello World";
		model.attributes.foo = str;
		expect(model.get('foo.length')).toBe(str.length);
	});
	
	it("has instances which by default have $appModel as the parent scope", function() {
		var model = new SingularModel();
		expect(model.parent).toBe($appModel);
	});
	
	it("has a constructor that accepts a parent model", function() {
		var model = new SingularModel(null);
		var submodel = new SingularModel(model);
		expect(submodel.parent).toBe(model);
	});
	
	it("has a constructor that results in a new application model (like $appModel) when passed null", function() {
		var model = new SingularModel(null);
		expect(model.parent).toBe(null);
	});
	
	it("can, when its parent is not null, be scoped so that attributes are first resolved within a namespace", function() {
		var model = new SingularModel(null);
		
		model.set('foo.bar', 'correct');
		model.set('bar', 'incorrect');
		model.set('foobar', 123);
		
		var submodel = new SingularModel(model, 'foo');
		
		expect(submodel.parent).toBe(model);
		expect(submodel.parentPrefix).toBe('foo');
		expect(submodel.get('bar')).toBe('correct');
		expect(submodel.get('foobar')).toBe(123);
	});
	
	it("has a use(namespace) method which creates a scoped submodel just like new SingularModel(parentModel, namespace)", function() {
		var model = new SingularModel(null);
		
		model.set('foo.bar', 'correct');
		model.set('bar', 'incorrect');
		model.set('foobar', 123);
		
		var submodel = model.use('foo');
		
		expect(submodel.parent).toBe(model);
		expect(submodel.parentPrefix).toBe('foo');
		expect(submodel.get('bar')).toBe('correct');
		expect(submodel.get('foobar')).toBe(123);
	});
	
	it("can relay changes down complex model heirarchies (test #1)", function() {
		var root = new SingularModel(null);
		var page = root.use('page');
		var view = page.use('recent');
		var subview = view.use('$');
		var each = subview.use('items[0]');
		var localValue = 0;
		
		each.watch('title', function(value) {
			localValue = value;
		});
		
		root.set('page.recent.items[0].title', 'correct');
		expect(localValue).toBe('correct');
	});
	
	it("can relay changes up complex model heirarchies (test #1)", function() {
		var root = new SingularModel(null);
		var page = root.use('page');
		var view = page.use('recent');
		var subview = view.use('$');
		var each = subview.use('items[0]');
		var localValue = 0;
		
		root.watch('page.recent.items[0].title', function(value) {
			localValue = value;
		});
		
		each.set('title', 'correct');
		expect(localValue).toBe('correct');
	});
	
	it("can relay changes up the model heirarchy and back down into a sibling branch", function() {
		var root = new SingularModel(null);
		root.set('foo.bar.baz', 'incorrect');
		var page = root.use('foo');
		var modelA = page.use('bar');
		var modelB = page.use('bar');
		var localValue = 0;
		
		modelA.watch('baz', function(value) {
			localValue = value;
		});
		
		modelB.set('baz', 'correct');
		
		expect(localValue).toBe('correct');
	});
	
	it("can get the value of an array index.", function() {
		var model = new SingularModel(null);
		model.attributes.foo = [123,124,125,126];
		expect(model.get('foo[1]')).toBe(124);
	});
	
	it("can set the value of an array index.", function() {
		var model = new SingularModel(null);
		model.attributes.foo = [123,124,125,126];
		model.set('foo[1]', 999);
		expect(model.attributes.foo[1]).toBe(999);
	});
	
	it("can call watchers when values change", function() {
		var model = new SingularModel(null);
		model.set('foo', 123);
		var localValue;
		model.watch('foo', function(value) {
			localValue = value;
		});
		expect(localValue).toBe(123);
		
		model.set('foo', 124);
		expect(localValue).toBe(124);
	});
	
	it("calls a newly registered watcher immediately with the initial value", function() {
		var model = new SingularModel(null);
		model.set('foo', 123);
		var localValue = 0;
		model.watch('foo', function(value) {
			localValue = value;
		});
		expect(localValue).toBe(123);
	});
	
	it("calls a newly registered watcher immediately with the initial value, when the watcher is on a submodel", function() {
		var model = new SingularModel(null);
		model.set('foo', 123);
		var submodel = new SingularModel(model);
		var localValue = 0;
		submodel.watch('foo', function(value) {
			localValue = value;
		});
		expect(localValue).toBe(123);
	});
	
	it("calls a newly registered watcher immediately with the initial value, when the watcher is on a leaf of a complex model heirarchy", function() {
		var root = new SingularModel(null);
		
		root.attributes.page = { recent: { items: [{title: 'correct'}] } };
		
		var page = root.use('page');
		var view = page.use('recent');
		var subview = view.use('$');
		var each = subview.use('items[0]');
		
		var localValue = 0;
		each.watch('title', function(value) {
			localValue = value;
		});
		expect(localValue).toBe('correct');
	});
	
	
	it("calls a newly registered watcher immediately with the initial value, when the watcher is on a leaf of a complex model heirarchy including '$[0]' namespaces", function() {
		var root = new SingularModel(null);
		
		root.attributes.page = { recent: { items: [{title: 'correct'}] } };
		
		var page = root.use('page');
		var view = page.use('recent');
		var subview = view.use('$');
		var each = subview.use('items');
		var item = each.use('$[0]');
		
		var localValue = 0;
		item.watch('title', function(value) {
			localValue = value;
		});
		expect(localValue).toBe('correct');
	});
	
	it("can get the value of a complicated local attribute", function() {
		var model = new SingularModel(null);
		model.attributes.nested = {
			getCheck:123
		};
		
		expect(model.get('nested.getCheck')).toBe(123);
	});
	
	it("can set the value of a complicated local attribute", function() {
		var model = new SingularModel(null);
		model.set('nested.setCheck', 123);
		
		expect(model.attributes.nested.setCheck).toBe(123);
	});
	
	it("can get the value of a simple attribute from its parent model", function() {
		var model = new SingularModel(null);
		model.set('foo', 123);
		var submodel = new SingularModel(model);
		expect(submodel.get('foo')).toBe(123);
	});
	
	it("can set the value of a simple attribute on its parent model", function() {
		var model = new SingularModel(null);
		var submodel = new SingularModel(model);
		submodel.set('foo', 123);
		expect(model.get('foo')).toBe(123);
	});
	
	it("can listen for changes that occur on parent models", function() {
		var model = new SingularModel(null);
		var submodel = new SingularModel(model);
		var localValue = 0;
		submodel.watch('foo', function(value) {
			localValue = value;
		});
		model.set('foo', 123);
		expect(localValue).toBe(123);
	});
	
	it("can listen for changes that occur on parent models (and not call the watcher twice)", function() {
		var model = new SingularModel(null);
		var submodel = new SingularModel(model);
		var count = 0;
		submodel.watch('foo', function(value) {
			++count;
		});
		model.set('foo', 123);
		expect(count).toBe(2);	// once for the initializer, once for the set
	});
	
	it("can listen for changes that occur on submodels", function() {
		var model = new SingularModel(null);
		var submodel = new SingularModel(model);
		var localValue = 0;
		model.watch('foo', function(value) {
			localValue = value;
		});
		submodel.set('foo', 123);
		expect(localValue).toBe(123);
	});
	
	it("can listen for changes that occur on submodels (and not call the watcher twice)", function() {
		var model = new SingularModel(null);
		var submodel = new SingularModel(model);
		var count = 0;
		model.watch('foo', function(value) {
			++count;
		});
		submodel.set('foo', 123);
		expect(count).toBe(2);	// once for the initializer, once for the set
	});
});
