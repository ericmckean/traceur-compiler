The code for this article was submitted as [revision 312](http://code.google.com/p/traceur-compiler/source/detail?r=87ea1a9d3182a163c28a98e80eb6cb059d3452cb). It is very likely that these instructions will get out of sync.

# Introduction #

The goal of this article is to walk you through how to add a new feature to Traceur Compiler. For the sake of simplicity we pick a simple feature. We are going to implement the object literal method shorthand. Its Harmony proposal allows you to do:

```
var object = {
  prop: 42,
  // No need for function
  method() {
    return this.prop;
  }
};
```

We are going to desugar this to the following:

```
var object = traceur.runtime.markMethods({
  prop: 42,
  // No need for function
  method: function() {
    return this.prop;
  }
}, ['method']);
```

where `markMethods` is going to set the enumerable bit to false.

To try this just copy paste the code into our [repl](http://traceur-compiler.googlecode.com/svn/trunk/demo/repl.html?r=312) demo.

# Overview #

There are a couple of different things that needs to be done to add support for new features.

  1. Add parsing support
  1. Add new tree type to the AST
  1. Implement the tree visitor that knows how to traverse the tree
  1. Validation of the tree
  1. Writer. This takes the AST and outputs the source code
  1. No op transformer
  1. Your transformer

These steps are not fully independent of course. Your parser will, for example, output trees of the new parse tree type that you added.

# Add parsing support #

In [Parser.js](http://code.google.com/p/traceur-compiler/source/browse/src/syntax/Parser.js) find the method `parsePropertyNameAssignment_`. To detect if we are going to parse a method assignment we peek ahead to see if the token following the current token is an `OPEN_PAREN`. If so we call `parsePropertyMethodAssignment_`, a method we are about to write.

```
/**
 * @return {ParseTree}
 * @private
 */
parsePropertyMethod_: function() {
  // Used for error reporting.
  var start = this.getTreeStartLocation_();
  // Note that parsePropertyAssignment_ already limits name to String,
  // Number & IdentfierName.
  var name = this.nextToken_();
  this.eat_(TokenType.OPEN_PAREN);
  var formalParameterList = this.parseFormalParameterList_();
  this.eat_(TokenType.CLOSE_PAREN);
  var functionBody = this.parseFunctionBody_();
  // We will define this next
  return new PropertyMethodAssignment(this.getTreeLocation_(start), name, formalParameterList, functionBody);
},
```

The code for this is almost identical to parseFunctionExpression_with the exception that we don’t have an optional name._

# Add the ParseTreeType #

In the code above we create a new instance of a `PropertyMethodAssignment` tree. The AST is built of “typed” parse tree nodes. Each of these have a type created by converting a ParseTrees property name from camelCase to ALL\_CAPITALS\_UNDERSCORED. The property names are defined in `ParseTrees.js`. For this example we add:

`ParseTrees.js`

```
/**
 * @param {traceur.util.SourceRange} location
 * @param {traceur.syntax.Token} name
 * @param {traceur.syntax.trees.FormalParameterList} formalParameterList
 * @param {traceur.syntax.trees.Block} functionBody
 * @constructor
 * @extends {ParseTree}
 */
PropertyMethodAssignment: create(
    'name',
    'formalParameterList',
    'functionBody'),
```

Adding this property will add a new type, ParseTreeType.PROPERTY\_METHOD\_ASSIGNMENT.

# Parse Tree Visitors #

A big part of Traceur is driven by tree visitors. For example, writer, validator and transformer all extend the ParseTreeVisitor class. Since the `PropertyMethodAssignment` consists of name, formal parameters and a function body a visitor need to visit these parts. The name part is just a single token which is a leaf in the AST we don’t need to include that.

`ParseTreeVisitor.js`

```
/**
 * @param {traceur.syntax.trees.PropertyMethodAssignment} tree
 */
visitPropertyMethodAssignment: function(tree) {
  this.visitAny(tree.formalParameterList);
  this.visitAny(tree.functionBody);
},
```

`visitAny` checks the type of the tree and calls the correct method to visit the sub trees as needed.

# Validation #

We have a validation step included after every single transformation. It should probably be optional but it is useful to find invalid transformations. The validation pass is another tree visitor that just validates the type of the different fields of the parse trees. In our case we need to update the validation of `visitObjectLiteralExpression` to also allow our new method assignment tree:

```
/**
 * @param {traceur.syntax.trees.ObjectLiteralExpression} tree
 */
visitObjectLiteralExpression: function(tree) {
  for (var i = 0; i < tree.propertyNameAndValues.length; i++) {
    var propertyNameAndValue = tree.propertyNameAndValues[i];
    switch (propertyNameAndValue.type) {
      case ParseTreeType.GET_ACCESSOR:
      case ParseTreeType.SET_ACCESSOR:
      case ParseTreeType.PROPERTY_METHOD_ASSIGNMENT:
      case ParseTreeType.PROPERTY_NAME_ASSIGNMENT:
      case ParseTreeType.PROPERTY_NAME_SHORTHAND:
        break;
      default:
        this.fail_(propertyNameAndValue,
            'accessor, property name assignment or property method assigment expected');
    }
    this.visitAny(propertyNameAndValue);
  }
},
```

# Tree Writer #

Even though ES5 code should never contain property method assignments we want to be able to serialize such a tree to a string. This is done by the `ParseTreeWriter` which is another parse tree visitor class. The code for this is once again pretty trivial:

```
/**
 * @param {PropertyMethodAssignment} tree
 */
visitPropertyMethodAssignment: function(tree) {
  this.write_(tree.name);
  this.write_(TokenType.OPEN_PAREN);
  this.visitAny(tree.formalParameterList);
  this.write_(TokenType.CLOSE_PAREN);
  this.visitAny(tree.functionBody);
},
```

# The transformer #

The `ProgramTransformer` is responsible for transforming the initial parse tree into a parse tree that ES5 can understand. The `ProgramTransformer` consists of several different `ParseTreeTransformer`s; usually one per feature.

The base class for all the transformers is the `ParseTreeTransformer`. It has one method per parse tree type so we need to tell it how to transform the `PropertyMethodAssignment` tree in the general case. This is so that other transformation passes can transform the individual parts.

`ParseTreeTransformer.js`

```
/**
 * @param {PropertyMethodAssignment} tree
 * @return {ParseTree}
 */
transformPropertyMethodAssignment: function(tree) {
  var parameters = this.transformAny(tree.formalParameterList);
  var functionBody = this.transformAny(tree.functionBody);
  if (parameters == tree.formalParameterList &&
      functionBody == tree.functionBody) {
    return tree;
  }
  return new PropertyMethodAssignment(null, tree.name, parameters,
                                      functionBody);
},
```

The code for this includes an optimization. If none of the subtrees needed to be transformed by the current transformation pass we just pass on the original tree. This reduces GC churn since in most cases the trees are not transformed.

To include your new code in traceur, (import and) export your new transformer in traceur.js. At this point you should be able to build and
> bring up [repl.html](http://traceur-compiler.googlecode.com/svn/trunk/demo/repl.html?r=312) and enter some object literals with methods in them. The generated code should now roundtrip but of course you will get evaluation errors because ES5 does not support this feature.

7.  The method assignment transformer

The semantics of the property method shorthand is to create a non enumerable property. There are few possible ways to achieve this. We could use `Object.create` to build the object. However, there is a simpler solution and that is to create the object and then update the enumerable internal field afterwards using `Object.defineProperty`. `Object.defineProperty` is not just for defining new properties, it can also be used to update existing ones.

Given an object literal with a method in it:

```
var object = {
  prop: 42,
  // No need for function
  method() {
    return this.prop;
  }
};
```

we want to generate code that looks something like this

```
var object = (function(obj) {
  Object.defineProperty(obj, 'method', {enumerable: false});
  return obj;
})({
  prop: 42,
  // No need for function
  method: function() {
    return this.prop;
  }
});
```

It might have been tempting to put the object literal inside a function but whenever possible keep things in the current scope or you will have to take care of things like arguments, this, return, breaks, continue etc.

The actual code we generate is slightly different. We use a runtime function to reduce the amount of code we generate.

```
traceur.runtime.markMethods( /* original object literal */,
                             /* array of method names */ )
```

We also define `markMethods` in `runtime.js` as:

```
/**
 * Marks properties as non enumerable.
 * @param {Object} object
 * @param {Array.<string>} names
 * @return {Object}
 */
function markMethods(object, names) {
  names.forEach(function(name) {
    Object.defineProperty(object, name, {enumerable: false});
  });
  return object;
}
```

Now that we know what we need to generate we need to figure out how to get the relevant information.

The solution I ended up using was to use a stack. Any time we enter an object literal we push an empty array on to this stack. When we hit a property method assignment tree we add the name of the method to the array that is currently at the top of the stack. When we get back to the object literal we pop the stack and check if we had seen any methods. If not we can just return an object literal expression. Otherwise we create a call expression that calls the `markMethods` function.

To do all this we create a new file called `PropertyMethodAssigmentTransformer.js` and create a new transformer.

```
transformPropertyMethodAssignment: function(tree) {
  addMethod(tree.name);

  var parameters = this.transformAny(tree.formalParameterList);
  var functionBody = this.transformAny(tree.functionBody);

  // If the name is an Identifier we use that as the name of the function
  // so that it is visible inside the function scope.
  var name = null;
  if (tree.name.type == TokenType.IDENTIFIER)
    name = tree.name;

  var fun = createFunctionDeclaration(name, parameters, functionBody);
  return new PropertyNameAssignment(tree.location, tree.name, fun);
}
```

As you can see we recursively transform the subparts of the tree. If we forget to do this nested object literals will not be handled correctly.

```
/**
  * @param {ObjectLiteralExpression} tree
  * @return {ParseTree}
  */
transformObjectLiteralExpression: function(tree) {
  // As we visit all the parts of the object literal we gather the methods.
  // When we get back we check if any methods were found and we do the
  // transformation as needed.
  methodStack.push([]);
 
  var propertyNameAndValues =
      this.transformList(tree.propertyNameAndValues);
  if (propertyNameAndValues == tree.propertyNameAndValues) {
    // No transformations done so that means that we didn't have any
    // methods.
    methodStack.pop();
    return tree;
  }

  var methods = methodStack.pop();
  var literal = createObjectLiteralExpression(propertyNameAndValues);
 
  // No methods found.
  if (!methods.length)
    return literal;
  
  return markMethods(literal, methods);
},
```

One thing that is worth pointing out is that the parse trees in Traceur are all immutable. It makes things much easier to reason about since we know that if the result of transformList is the same as the original list no transformations were made.

```
function markMethods(objectLit, methodTokens) {
  // traceur.runtime.markMethods
  var markMethods = createMemberExpression(TRACEUR, RUNTIME, MARK_METHODS);
 
  // Transform all the tokens to string expressions parse trees.
  var methodNames = methodTokens.map(function(token) {
    if (token.type == TokenType.STRING)
      return new LiteralExpression(null, token);
    return createStringLiteral(token.toString());
  });

  return createCallExpression(markMethods,
                              createArgumentList(objectLit,
                        createArrayLiteralExpression(methodNames)));
}
```

# Creating your own transformation passes #

This pass is pretty simple but as you might have noticed there is still quite a lot of boiler plate code to add. The easiest way to add a new pass is still to look at a previous pass to see what was added for that, either by looking at the diffs or by searching for references to it in the code. When I wrote this I looked a lot at the [PropertyNameShorthand change](http://code.google.com/p/traceur-compiler/source/detail?r=284).

# Contributions #

See [Contributions](Contributions.md) page for details