// Copyright 2013 Traceur Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  AttachModuleNameTransformer
} from '../codegeneration/module/AttachModuleNameTransformer';
import {FromOptionsTransformer} from '../codegeneration/FromOptionsTransformer';
import {ModuleAnalyzer} from '../semantics/ModuleAnalyzer';
import {ModuleSpecifierVisitor} from
    '../codegeneration/module/ModuleSpecifierVisitor';
import {ModuleSymbol} from '../semantics/symbols/ModuleSymbol';
import {Parser} from '../syntax/Parser';
import {SourceFile} from '../syntax/SourceFile';
import {TreeWriter} from '../outputgeneration/TreeWriter';
import {UniqueIdentifierGenerator} from
    '../codegeneration/UniqueIdentifierGenerator';
import {isAbsolute, resolveUrl} from '../util/url';
import {webLoader} from './webLoader';


import {assert} from '../util/assert';

// TODO These CodeUnit (aka Load) states are used by code in this file
// that belongs in Loader.
var NOT_STARTED = 0;
var LOADING = 1;
var LOADED = 2;
var PARSED = 3;
var TRANSFORMED = 4;
var COMPLETE = 5;
var ERROR = 6;

var identifierGenerator = new UniqueIdentifierGenerator();

export class LoaderHooks {
  constructor(reporter, rootUrl, outputOptions, fileLoader = webLoader) {
    this.reporter = reporter;
    this.rootUrl_ = rootUrl;
    this.outputOptions_ = outputOptions;
    this.fileLoader = fileLoader;
    this.analyzer_ = new ModuleAnalyzer(this.reporter);
  }

  // TODO Used for eval(): can we get the function call to supply callerURL?
  rootUrl() {
    return this.rootUrl_;
  }

  getModuleSpecifiers(codeUnit) {
    // Parse
    if (!this.parse(codeUnit))
      return;

    codeUnit.state = PARSED;

    // Analyze to find dependencies
    var moduleSpecifierVisitor = new ModuleSpecifierVisitor(this.reporter);
    moduleSpecifierVisitor.visit(codeUnit.data.tree);
    return moduleSpecifierVisitor.moduleSpecifiers;
  }

  parse(codeUnit) {
    assert(!codeUnit.data.tree);
    var reporter = this.reporter;
    var normalizedName = codeUnit.name;
    var program = codeUnit.text;
    var file = new SourceFile(codeUnit.url, program);
    var parser = new Parser(reporter, file);
    if (codeUnit.type == 'module')
      codeUnit.data.tree = parser.parseModule();
    else
      codeUnit.data.tree = parser.parseScript();

    codeUnit.data.moduleSymbol =
      new ModuleSymbol(codeUnit.data.tree, normalizedName);

    return !reporter.hadError();
  }

  transform(codeUnit) {
    var transformer = new AttachModuleNameTransformer(codeUnit.name);
    var transformedTree = transformer.transformAny(codeUnit.data.tree);
    transformer = new FromOptionsTransformer(this.reporter,
        identifierGenerator);

    return transformer.transform(transformedTree);
  }

  fetch({address}, callback, errback) {
    this.fileLoader.load(address, callback, errback);
  }

  instantiate({name, metadata, address, source, sourceMap}) {
    return undefined;
  }

  locate(load) {
    load.url = this.locate_(load);
    return load.url;
  }

  locate_(load) {
    var normalizedModuleName = load.name;
    var asJS = normalizedModuleName + '.js';
    // Tolerate .js endings
    if (/\.js$/.test(normalizedModuleName))
      asJS = normalizedModuleName;
    if (System.referrerName) {
      if (asJS.indexOf(System.referrerName) === 0) {
        asJS = asJS.substring(System.referrerName.length);
      }
    }
    if (isAbsolute(asJS))
      return asJS;
    var baseURL = load.metadata && load.metadata.baseURL;
    baseURL = baseURL || this.rootUrl();
    if (baseURL)
      return resolveUrl(baseURL, asJS);
    return asJS;
  }

  evaluateCodeUnit(codeUnit) {
    // Source for modules compile into calls to registerModule(url, fnc).
    //
    // TODO(arv): Eval in the right context.
    var result = ('global', eval)(codeUnit.data.transcoded);
    codeUnit.data.transformedTree = null;
    return result;
  }

  analyzeDependencies(dependencies, loader) {
    var trees = [];
    var moduleSymbols = [];
    for (var i = 0; i < dependencies.length; i++) {
      var codeUnit = dependencies[i];

      // We should not have gotten here if not all are PARSED or larget.
      assert(codeUnit.state >= PARSED);

      if (codeUnit.state == PARSED) {
        trees.push(codeUnit.data.tree);
        moduleSymbols.push(codeUnit.data.moduleSymbol);
      }
    }

    this.analyzer_.analyzeTrees(trees, moduleSymbols, loader);
    this.checkForErrors(dependencies, 'analyze');
  }

  // TODO(jjb): this function belongs in Loader
  transformDependencies(dependencies) {
    for (var i = 0; i < dependencies.length; i++) {
      var codeUnit = dependencies[i];
      if (codeUnit.state >= TRANSFORMED) {
        continue;
      }
      this.transformCodeUnit(codeUnit);
      this.instantiate(codeUnit);
    }
    this.checkForErrors(dependencies, 'transform');
  }

  transformCodeUnit(codeUnit) {
    this.transformDependencies(codeUnit.dependencies); // depth first
    codeUnit.data.transformedTree = codeUnit.transform();
    codeUnit.state = TRANSFORMED;
    codeUnit.data.transcoded =  TreeWriter.write(codeUnit.data.transformedTree,
        this.outputOptions_);
    if (codeUnit.url && codeUnit.data.transcoded)
      codeUnit.data.transcoded += '//# sourceURL=' + codeUnit.url;
    // TODO(jjb): return sourcemaps not sideeffect
    codeUnit.sourceMap =
      this.outputOptions_ && this.outputOptions_.sourceMap;
  }


  checkForErrors(dependencies, phase) {
    if (this.reporter.hadError()) {
      for (var i = 0; i < dependencies.length; i++) {
        var codeUnit = dependencies[i];
        if (codeUnit.state >= COMPLETE) {
          continue;
        }
        codeUnit.state = ERROR;
      }

      for (var i = 0; i < dependencies.length; i++) {
        var codeUnit = dependencies[i];
        if (codeUnit.state == ERROR) {
          codeUnit.dispatchError(phase);
        }
      }
    }
  }

}
