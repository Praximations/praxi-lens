import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRepositorySnapshot, readmeSummary } from '../dist/adapters/repository/index.js';

const file = (path, content) => ({ path, content });
const snapshot = {
  id: 'owner/poly', name: 'owner/poly', revision: 'c'.repeat(40), sourceUrl: 'https://github.com/owner/poly',
  description: 'A polyglot fixture', topics: ['testing'],
  files: [
    file('README.md', '# Poly\n\n[![build](https://x/y.svg)](https://x)\n\nPoly is a **small** example that shows how [Lens](https://x) reads many languages at once.\n\n```sh\nnpm run secret-command\n```\n'),
    file('requirements.txt', 'requests>=2\n# comment\npyyaml==6\n-r other.txt\n'),
    file('pkg/__init__.py', ''),
    file('pkg/core.py', '"""\nimport fake_doc\n"""\nfrom .util import helper\nimport os, json\nimport requests\nimport yaml\nfrom pkg.models import User\nfrom . import util\n# import fake_comment\ndef run():\n    return helper()\nclass Engine:\n    pass\n'),
    file('pkg/util.py', 'def helper():\n    return 1\n'),
    file('pkg/models/__init__.py', 'class User: pass\n'),
    file('go.mod', 'module example.com/app\n\ngo 1.22\n\nrequire (\n\tgithub.com/spf13/cobra v1.8.0\n\tgolang.org/x/sys v0.1.0 // indirect\n)\n'),
    file('cmd/app/main.go', 'package main\n\n// import "fake/comment"\nimport (\n\t"fmt"\n\t"example.com/app/internal/store"\n\t"github.com/spf13/cobra/doc"\n)\n\nfunc Main() { fmt.Println(store.Open, doc.X) }\n'),
    file('internal/store/store.go', 'package store\n\nfunc Open() {}\n'),
    file('Cargo.toml', '[package]\nname = "engine"\n\n[dependencies]\nserde = { version = "1", features = ["derive"] }\n\n[dev-dependencies.proptest]\nversion = "1"\n'),
    file('src/lib.rs', 'mod parser;\npub mod net;\nuse crate::parser::Token;\nuse serde::Deserialize;\nuse std::fmt;\n// use crate::fake;\npub fn start() {}\n'),
    file('src/parser.rs', 'pub struct Token;\n'),
    file('src/net/mod.rs', 'use super::parser::Token;\n'),
    file('src/main/java/com/acme/App.java', 'package com.acme;\nimport com.acme.service.UserService;\nimport java.util.List;\nimport org.springframework.boot.SpringApplication;\npublic class App {}\n'),
    file('src/main/java/com/acme/service/UserService.java', 'package com.acme.service;\npublic class UserService {}\n'),
    file('native/main.c', '#include "util.h"\n#include <stdio.h>\n/* #include "fake.h" */\nint main() { return 0; }\n'),
    file('native/util.h', 'int util(void);\n'),
    file('tsconfig.json', '{\n  // comments are allowed\n  "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./web/*"] }, },\n}\n'),
    file('web/app.tsx', "import { Button } from '@/ui/button';\nimport shared from '@acme/shared';\nimport { readFile } from 'node:fs';\nimport path from 'path';\nexport const App = () => null;\n"),
    file('web/ui/button.tsx', 'export function Button() { return null; }\n'),
    file('packages/shared/package.json', '{"name":"@acme/shared","main":"dist/index.js","dependencies":{"zod":"3"}}'),
    file('packages/shared/src/index.ts', 'export default 1;\n'),
    file('package.json', '{"dependencies":{"@acme/shared":"workspace:*","react":"19"}}'),
    file('lib/app.rb', "require_relative 'helpers'\nrequire 'json'\nrequire 'sinatra'\nclass App; end\n"),
    file('lib/helpers.rb', 'module Helpers; end\n'),
  ],
};
const result = analyzeRepositorySnapshot(snapshot);
const edge = (from, to) => result.model.relationships.find(r => r.from === `file:${from}` && r.to === to);

test('Python imports resolve relative, absolute and package forms without reading docstrings or comments', () => {
  assert.ok(edge('pkg/core.py', 'file:pkg/util.py'));
  assert.ok(edge('pkg/core.py', 'file:pkg/models/__init__.py'));
  assert.ok(edge('pkg/core.py', 'package:pypi:requests'));
  assert.ok(edge('pkg/core.py', 'package:pypi:pyyaml'), 'import names map to distribution names');
  assert.ok(edge('requirements.txt', 'package:pypi:requests'));
  assert.equal(result.model.components.some(c => c.id.includes('os') && c.kind === 'package-reference'), false, 'standard library is not an outside package');
  const text = JSON.stringify(result);
  for (const fake of ['fake_doc', 'fake_comment', 'fake/comment', 'fake.h', 'crate::fake', 'secret-command']) assert.equal(text.includes(fake), false, fake);
  const core = result.model.components.find(c => c.id === 'file:pkg/core.py').extensions['praxi.software'].data;
  assert.deepEqual(core.exports.sort(), ['Engine', 'run']);
  assert.equal(core.language, 'Python');
  assert.equal(core.lines, 15);
});

test('Go imports resolve module packages to folders and external modules to required packages', () => {
  assert.ok(edge('cmd/app/main.go', 'dir:internal/store'));
  assert.ok(edge('cmd/app/main.go', 'package:go:github.com/spf13/cobra'));
  assert.ok(edge('go.mod', 'package:go:github.com/spf13/cobra'));
  assert.equal(result.model.components.some(c => c.id === 'package:go:golang.org/x/sys'), false, 'indirect requirements are not declared dependencies');
});

test('Rust, Java, C and Ruby references resolve to files, packages or the standard library', () => {
  assert.equal(edge('src/lib.rs', 'file:src/parser.rs').kind, 'declares-module');
  assert.ok(edge('src/lib.rs', 'file:src/net/mod.rs'));
  assert.ok(edge('src/lib.rs', 'package:cargo:serde'));
  assert.ok(edge('src/net/mod.rs', 'file:src/parser.rs'));
  assert.ok(edge('Cargo.toml', 'package:cargo:proptest'));
  assert.ok(edge('src/main/java/com/acme/App.java', 'file:src/main/java/com/acme/service/UserService.java'));
  assert.ok(edge('src/main/java/com/acme/App.java', 'package:jvm:org.springframework.boot'));
  assert.equal(edge('native/main.c', 'file:native/util.h').kind, 'includes');
  assert.ok(edge('lib/app.rb', 'file:lib/helpers.rb'));
  assert.ok(edge('lib/app.rb', 'package:gem:sinatra'));
  assert.equal(result.model.components.some(c => c.id === 'package:gem:json'), false);
});

test('TypeScript path aliases and workspace packages resolve to repository source', () => {
  assert.ok(edge('web/app.tsx', 'file:web/ui/button.tsx'));
  assert.ok(edge('web/app.tsx', 'file:packages/shared/src/index.ts'), 'workspace package resolves to its own source');
  assert.ok(edge('package.json', 'dir:packages/shared'), 'sibling workspace dependency is internal');
  assert.equal(result.model.components.some(c => c.id === 'package:@acme/shared'), false);
  assert.equal(result.model.components.some(c => c.id === 'package:path' || c.id === 'package:node:fs'), false);
  assert.ok(result.stats.standardLibraryImports >= 5);
});

test('repository metadata, README summary and language counts describe the project', () => {
  const data = result.model.system.extensions['praxi.software'].data;
  assert.equal(data.description, 'A polyglot fixture');
  assert.deepEqual(data.topics, ['testing']);
  assert.equal(data.summary, 'Poly is a small example that shows how Lens reads many languages at once.');
  assert.deepEqual(result.model.system.provenance.evidenceIds, ['evidence:tree', 'evidence:readme', 'evidence:metadata']);
  assert.equal(result.stats.languages.Python, 4);
  assert.equal(result.stats.languages.Go, 2);
  assert.equal(result.stats.unresolvedImports, 0, JSON.stringify(result.diagnostics));
  assert.equal(readmeSummary('# Title\n\n- just a list item with enough words to pass\n\nShort.'), undefined);
});
