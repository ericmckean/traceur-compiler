# Language Features #

  * [Classes](LanguageFeatures#Classes.md)
  * [Modules](LanguageFeatures#Modules.md) (in progress)
  * [Iterators and For Of Loops](LanguageFeatures#Iterators_and_For_Of_Loops.md)
  * [Generators](LanguageFeatures#Generators.md)
  * [Deferred Functions](LanguageFeatures#Deferred_Functions.md) - _Strawman_
  * [Block Scoped Bindings](LanguageFeatures#Block_Scoped_Bindings.md)
  * [Destructuring Assignment](LanguageFeatures#Destructuring_Assignment.md)
  * [Default Parameters](LanguageFeatures#Default_Parameters.md)
  * [Rest Parameters](LanguageFeatures#Rest_Parameters.md)
  * [Spread Operator](LanguageFeatures#Spread_Operator.md)
  * [Object Initialiser Shorthand](LanguageFeatures#Object_Initialiser_Shorthand.md)
  * [Property Method Assignment](LanguageFeatures#Property_Method_Assignment.md)

Property Method Assignment

These features are [proposals](http://wiki.ecmascript.org/doku.php?id=harmony:proposals) for ECMAScript Harmony unless otherwise noted.

## Classes ##

This implements class syntax and semantics as described in the ES6 draft spec. In earlier versions of Traceur we had more feature rich classes but in the spirit of Harmony we have scaled back and are now only supporting the minimal class proposal.

[Classes](http://en.wikipedia.org/wiki/Class_(computer_programming)) are a great way to reuse code. Several JS libraries provide classes and inheritance, but they aren't mutually compatible. Here's an example:

```
class Monster extends Character {
  constructor(x, y, name) {
    super(x, y);
    this.name = name;
    this.health_ = 100;
  }

  attack(character) {
    super.attack(character);
  }

  get isAlive() { return this.health > 0; }
  get health() { return this.health_; }
  set health(value) {
    if (value < 0) throw new Error('Health must be non-negative.');
    this.health_ = value;
  }
}
```

Here's an example of subclassing an HTML button:
```
class CustomButton extends HTMLButtonElement {
  constructor() {
    this.value = 'Custom Button';
  }
  // ... other methods ...
}
var button = new CustomButton();
document.body.appendChild(button);
```

**Warning** This is currently not supported.

## Modules ##

[Modules](http://wiki.ecmascript.org/doku.php?id=harmony:modules) are not ready to use yet in Traceur, but they are partially implemented. Modules try to solve many issues in dependencies and deployment, allowing users to name external modules, import specific exported names from those modules, and keep these names separate.

```
module Profile {
  // module code
  export var firstName = 'David';
  export var lastName = 'Belle';
  export var year = 1973;
}

module ProfileView {
  import Profile.{firstName, lastName, year};

  function setHeader(element) {
    element.textContent = firstName + ' ' + lastName;
  }
  // rest of module
}
```

## Iterators and For Of Loops ##

[Iterators](http://en.wikipedia.org/wiki/Iterator) are objects that can traverse a container. It's a useful way to make a class work inside a for of loop. The interface is similar to the [iterators](http://wiki.ecmascript.org/doku.php?id=harmony:iterators) proposal. Iterating with a for of loop looks like:
```
for (let element of [1, 2, 3]) {
  console.log(element);
}
```

You can also create your own iterable objects. Normally this is done via the `yield` keyword (discussed below in [Generators](LanguageFeatures#Generators.md)) but it could be done explicitly by returning an object that has `__iterator__`:
```
function iterateElements(array) {
  return {
    __iterator__: function() {
      var index = 0;
      var current;
      return {
        get current() {
          return current;
        },
        moveNext: function() {
          if (index < array.length) {
            current = array[index++];
            return true;
          }
          return false;
        }
      };
    }
  };
}
```

## Generators ##

[Generators](http://wiki.ecmascript.org/doku.php?id=harmony:generators) make it easy to create iterators. Instead of tracking state yourself and implementing `__iterator__`, you just use `yield` (or `yield*` to yield each element in an iterator):

```
// A binary tree class.
function Tree(left, label, right) {
  this.left = left;
  this.label = label;
  this.right = right;
}
// A recursive generator that iterates the Tree labels in-order.
function* inorder(t) {
  if (t) {
    yield* inorder(t.left);
    yield t.label;
    yield* inorder(t.right);
  }
}

// Make a tree
function make(array) {
  // Leaf node:
  if (array.length == 1) return new Tree(null, array[0], null);
  return new Tree(make(array[0]), array[1], make(array[2]));
}
let tree = make([[['a'], 'b', ['c']], 'd', [['e'], 'f', ['g']]]);

// Iterate over it
for (let node of inorder(tree)) {
  console.log(node); // a, b, c, d, ...
}
```

A generator function needs to be anotated as `function*` instead of just `function`.

## Deferred Functions ##

[Deferred functions](http://wiki.ecmascript.org/doku.php?id=strawman:deferred_functions) allow you to write asynchronous non-blocking code without writing callback functions, which don't compose well. With deferred functions, you can use JavaScript control flow constructs that you're used to, inline with the rest of your code.

```
function deferredAnimate(element) {
    for (var i = 0; i < 100; ++i) {
        element.style.left = i;
        await deferredTimeout(20);
    }
};

deferredAnimate(document.getElementById('box'));
```

Deferred functions use await expressions to suspend execution and return an object that represents the continuation of the function.

## Block Scoped Bindings ##

[Block scoped bindings](http://wiki.ecmascript.org/doku.php?id=harmony:block_scoped_bindings) provide scopes other than the function and top level scope. This ensures your variables don't leak out of the scope they're defined:
```
{
  const tmp = a;
  a = b;
  b = tmp;
}
alert(tmp); // error: 'tmp' is not defined.
```
It's also useful for capturing variables in a loop:
```
let funcs = [];
for (let i of [4,5,6]) {
  funcs.push(function() { return i; });
}
for (var func of funcs) {
  console.log(func()); // 4, 5, 6
}
```

## Destructuring Assignment ##

[Destructuring assignment](http://wiki.ecmascript.org/doku.php?id=harmony:destructuring) is a nice way to assign or initialize several variables at once:
```
var [a, [b], c, d] = ['hello', [', ', 'junk'], ['world']];
alert(a + b + c); // hello, world
```
It can also destructure objects:
```
var pt = {x: 123, y: 444};
var rect = {topLeft: {x: 1, y: 2}, bottomRight: {x: 3, y: 4}};
// ... other code ...
var {x, y} = pt; // unpack the point
var {topLeft: {x: x1, y: y1}, bottomRight: {x: x2, y: y2}} = rect;

alert(x + y); // 567
alert([x1, y1, x2, y2].join(',')) // 1,2,3,4
```

## Default Parameters ##

[default parameters](http://wiki.ecmascript.org/doku.php?id=harmony:parameter_default_values) allow your functions to have optional arguments without needing to check `arguments.length` or check for `undefined`.

```
function slice(list, indexA = 0, indexB = list.length) {
  // ... 
}
```

## Rest Parameters ##

[Rest parameters](http://wiki.ecmascript.org/doku.php?id=harmony:rest_parameters) allows your functions to have variable number of arguments without using the `arguments` object.

```
function push(array, ...items) {
  items.forEach(function(item) {
    array.push(item);
  });
}
```

The rest parameter is an instance of `Array` so all the array methods just works.

## Spread Operator ##

The [spread operator](http://wiki.ecmascript.org/doku.php?id=harmony:spread) is like the reverse of [rest parameters](LanguageFeatures#Rest_Parameters.md). It allows you to expand an array into multiple formal parameters.

```
function push(array, ...items) {
  array.push(...items);
}

function add(x, y) {
  return x + y;
}

var numbers = [4, 38];
add(...numbers);  // 42
```

The spread operator also works in array literals which allows you to combine multiple arrays more easily.

```
var a = [1];
var b = [2, 3, 4];
var c = [6, 7];
var d = [0, ...a, ...b, 5, ...c];
```


## Object Initialiser Shorthand ##

This [proposal](http://wiki.ecmascript.org/doku.php?id=strawman:object_initialiser_shorthand) allows you to skip repeating yourself when the property name and property value are the same in an object literal.

```
function getPoint() {
  var x = ...;
  var y = ...;
  ...
  return {x, y};
}
```


## Property Method Assignment ##

Did you ever end up staring at code looking like this wondering where the syntax error was?

```

var object = {
  value: 42,
  toString() {
    return this.value;
  }
};
```

This [proposal](http://wiki.ecmascript.org/doku.php?id=harmony:concise_object_literal_extensions#methods) makes this a valid way to define methods on objects. The methods are non enumerable so that they behave like the methods on the built in objects.