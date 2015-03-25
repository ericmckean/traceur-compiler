How to translate output source coordinates to input source coordinates

# Introduction #
Traceur compiles futuristic ECMAScript into JavaScript that can run in today's browsers. A **Source Map** relates the low-level output to the original source.  Runtime error messages in the low-level code and  debugging tools running on the generated source can use the source map information to convert their output to reference the original source.

Traceur uses Moziila's source map implementation, https://github.com/mozilla/source-map

# Details #

To generate a source map, create and pass a **SourceMapGenerator** on the **options** object to a **Writer** such as the **ProjectWriter**. Then call **write()** to convert the **ParseTree** to generated source code. After the call, the **options** object will have a **sourceMap** property.

Traceur's repl demo gives an example of generating source maps:
```
      var options;
      if (traceur.options.sourceMaps) {
        var config = {file: 'traceured.js'};
        var sourceMapGenerator = new SourceMapGenerator(config);
        options = {sourceMapGenerator: sourceMapGenerator};
      } 

      var source = output.textContent = ProjectWriter.write(res, options);
```

To use the source map in, for example, Chrome devtools, you must embed the Traceur compiler in a Web Server and serve the source map at a URL you assign to a **X-SourceMap** header when you serve the source .