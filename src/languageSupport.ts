import * as vscode from 'vscode';

interface GmshCommandDef {
  label: string;
  kind: vscode.CompletionItemKind;
  detail: string;
  documentation: string;
  insertText?: string;
  signature?: {
    label: string;
    parameters: { label: string; doc: string }[];
  };
}

const GMSH_COMMANDS: GmshCommandDef[] = [
  // 0D / 1D / 2D / 3D Entities
  {
    label: 'Point',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Point(tag) = {x, y, z, lc};',
    documentation: '**Point**: Creates a geometric point at coordinates `(x, y, z)` with optional target mesh element size `lc`.\n\n```gmsh\nPoint(1) = {0, 0, 0, 0.1};\n```',
    insertText: 'Point(${1:1}) = {${2:x}, ${3:y}, ${4:z}${5:, lc}};'
  },
  {
    label: 'Line',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Line(tag) = {startPoint, endPoint};',
    documentation: '**Line**: Creates a straight line segment connecting two points.\n\n```gmsh\nLine(1) = {1, 2};\n```',
    insertText: 'Line(${1:1}) = {${2:startPoint}, ${3:endPoint}};'
  },
  {
    label: 'Circle',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Circle(tag) = {startPoint, centerPoint, endPoint};',
    documentation: '**Circle**: Creates a circular arc passing from `startPoint` to `endPoint` around `centerPoint` (angle <= Pi).\n\n```gmsh\nCircle(1) = {1, 2, 3};\n```',
    insertText: 'Circle(${1:1}) = {${2:startPoint}, ${3:centerPoint}, ${4:endPoint}};'
  },
  {
    label: 'Spline',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Spline(tag) = {pointList};',
    documentation: '**Spline**: Creates a cubic spline curve interpolating a sequence of points.\n\n```gmsh\nSpline(1) = {1, 2, 3, 4};\n```',
    insertText: 'Spline(${1:1}) = {${2:points}};'
  },
  {
    label: 'BSpline',
    kind: vscode.CompletionItemKind.Function,
    detail: 'BSpline(tag) = {pointList};',
    documentation: '**BSpline**: Creates a non-uniform B-spline curve approximated by a sequence of control points.',
    insertText: 'BSpline(${1:1}) = {${2:points}};'
  },
  {
    label: 'Bezier',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Bezier(tag) = {pointList};',
    documentation: '**Bezier**: Creates a Bezier curve defined by control points.',
    insertText: 'Bezier(${1:1}) = {${2:points}};'
  },
  {
    label: 'Curve Loop',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Curve Loop(tag) = {curveList};',
    documentation: '**Curve Loop**: Creates a closed boundary loop made of curves (lines, circles, splines). Negative curve tags indicate reversed orientation.\n\n```gmsh\nCurve Loop(1) = {1, 2, -3, 4};\n```',
    insertText: 'Curve Loop(${1:1}) = {${2:curves}};'
  },
  {
    label: 'Plane Surface',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Plane Surface(tag) = {curveLoopList};',
    documentation: '**Plane Surface**: Creates a planar surface bounded by one or more `Curve Loop`s (first is outer boundary, subsequent loops are holes).\n\n```gmsh\nPlane Surface(1) = {1};\n```',
    insertText: 'Plane Surface(${1:1}) = {${2:curveLoop}};'
  },
  {
    label: 'Surface',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Surface(tag) = {curveLoopList};',
    documentation: '**Surface**: Creates a 3D ruled or CAD surface spanning the specified `Curve Loop`.\n\n```gmsh\nSurface(1) = {1};\n```',
    insertText: 'Surface(${1:1}) = {${2:curveLoop}};'
  },
  {
    label: 'Surface Loop',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Surface Loop(tag) = {surfaceList};',
    documentation: '**Surface Loop**: Creates a closed shell formed by oriented surfaces to bound a `Volume`.\n\n```gmsh\nSurface Loop(1) = {1, 2, 3, 4, 5, 6};\n```',
    insertText: 'Surface Loop(${1:1}) = {${2:surfaces}};'
  },
  {
    label: 'Volume',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Volume(tag) = {surfaceLoopList};',
    documentation: '**Volume**: Defines a 3D volume enclosed by `Surface Loop`s.\n\n```gmsh\nVolume(1) = {1};\n```',
    insertText: 'Volume(${1:1}) = {${2:surfaceLoop}};'
  },

  // OpenCASCADE Primitives
  {
    label: 'SetFactory',
    kind: vscode.CompletionItemKind.Method,
    detail: 'SetFactory("OpenCASCADE" | "Built-in");',
    documentation: '**SetFactory**: Switches geometry kernel between Gmsh Built-in and OpenCASCADE (OCC).\n\n```gmsh\nSetFactory("OpenCASCADE");\n```',
    insertText: 'SetFactory("${1|OpenCASCADE,Built-in|}");'
  },
  {
    label: 'Box',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Box(tag) = {x, y, z, dx, dy, dz};',
    documentation: '**Box** (OpenCASCADE): Creates an axis-aligned 3D box starting at `(x, y, z)` with extents `(dx, dy, dz)`.\n\n```gmsh\nBox(1) = {0, 0, 0, 1, 2, 3};\n```',
    insertText: 'Box(${1:1}) = {${2:x}, ${3:y}, ${4:z}, ${5:dx}, ${6:dy}, ${7:dz}};'
  },
  {
    label: 'Cylinder',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Cylinder(tag) = {x, y, z, dx, dy, dz, r, [alpha]};',
    documentation: '**Cylinder** (OpenCASCADE): Creates a cylinder with base center `(x, y, z)`, axis `(dx, dy, dz)`, radius `r`, and optional angle `alpha`.\n\n```gmsh\nCylinder(1) = {0, 0, 0, 0, 0, 1, 0.5};\n```',
    insertText: 'Cylinder(${1:1}) = {${2:x}, ${3:y}, ${4:z}, ${5:dx}, ${6:dy}, ${7:dz}, ${8:r}};'
  },
  {
    label: 'Sphere',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Sphere(tag) = {x, y, z, r, [alpha1, alpha2, alpha3]};',
    documentation: '**Sphere** (OpenCASCADE): Creates a solid sphere centered at `(x, y, z)` with radius `r`.\n\n```gmsh\nSphere(1) = {0, 0, 0, 1.0};\n```',
    insertText: 'Sphere(${1:1}) = {${2:x}, ${3:y}, ${4:z}, ${5:r}};'
  },
  {
    label: 'Torus',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Torus(tag) = {x, y, z, r1, r2, [alpha]};',
    documentation: '**Torus** (OpenCASCADE): Creates a torus with major radius `r1` and minor radius `r2`.',
    insertText: 'Torus(${1:1}) = {${2:x}, ${3:y}, ${4:z}, ${5:r1}, ${6:r2}};'
  },
  {
    label: 'Cone',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Cone(tag) = {x, y, z, dx, dy, dz, r1, r2, [alpha]};',
    documentation: '**Cone** (OpenCASCADE): Creates a conical frustum with base radii `r1` and top radii `r2`.',
    insertText: 'Cone(${1:1}) = {${2:x}, ${3:y}, ${4:z}, ${5:dx}, ${6:dy}, ${7:dz}, ${8:r1}, ${9:r2}};'
  },
  {
    label: 'Wedge',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Wedge(tag) = {x, y, z, dx, dy, dz, ltx};',
    documentation: '**Wedge** (OpenCASCADE): Creates a right angular wedge.',
    insertText: 'Wedge(${1:1}) = {${2:x}, ${3:y}, ${4:z}, ${5:dx}, ${6:dy}, ${7:dz}, ${8:ltx}};'
  },

  // Transformations & Extrusions
  {
    label: 'Extrude',
    kind: vscode.CompletionItemKind.Keyword,
    detail: 'Extrude {dx, dy, dz} { ... }',
    documentation: '**Extrude**: Extrudes curves into surfaces, or surfaces into volumes, with optional mesh layering.\n\n```gmsh\nout[] = Extrude {0, 0, 1} {\n  Surface{1}; Layers{5};\n};\n```',
    insertText: 'Extrude {${1:dx}, ${2:dy}, ${3:dz}} {\n  ${4:Surface}{${5:1}};\n};'
  },
  {
    label: 'Translate',
    kind: vscode.CompletionItemKind.Keyword,
    detail: 'Translate {dx, dy, dz} { ... }',
    documentation: '**Translate**: Translates the specified entities by vector `(dx, dy, dz)`.\n\n```gmsh\nTranslate {1, 0, 0} { Point{1}; }\n```',
    insertText: 'Translate {${1:dx}, ${2:dy}, ${3:dz}} {\n  ${4:Curve}{${5:1}};\n}'
  },
  {
    label: 'Rotate',
    kind: vscode.CompletionItemKind.Keyword,
    detail: 'Rotate {{ax, ay, az}, {px, py, pz}, angle} { ... }',
    documentation: '**Rotate**: Rotates entities around axis direction vector `(ax, ay, az)` passing through point `(px, py, pz)` by angle (in radians).\n\n```gmsh\nRotate {{0, 0, 1}, {0, 0, 0}, Pi/2} { Surface{1}; }\n```',
    insertText: 'Rotate { {${1:ax}, ${2:ay}, ${3:az}}, {${4:px}, ${5:py}, ${6:pz}}, ${7:angle} } {\n  ${8:Surface}{${9:1}};\n}'
  },
  {
    label: 'Dilate',
    kind: vscode.CompletionItemKind.Keyword,
    detail: 'Dilate {{px, py, pz}, factor} { ... }',
    documentation: '**Dilate**: Scales entities relative to center `(px, py, pz)` by `factor`.\n\n```gmsh\nDilate {{0, 0, 0}, 2.0} { Surface{1}; }\n```',
    insertText: 'Dilate { {${1:px}, ${2:py}, ${3:pz}}, ${4:factor} } {\n  ${5:Surface}{${6:1}};\n}'
  },
  {
    label: 'Symmetry',
    kind: vscode.CompletionItemKind.Keyword,
    detail: 'Symmetry {a, b, c, d} { ... }',
    documentation: '**Symmetry**: Mirrors entities across plane `a*x + b*y + c*z + d = 0`.\n\n```gmsh\nSymmetry {0, 1, 0, 0} { Surface{1}; }\n```',
    insertText: 'Symmetry {${1:a}, ${2:b}, ${3:c}, ${4:d}} {\n  ${5:Surface}{${6:1}};\n}'
  },

  // Booleans (OCC)
  {
    label: 'BooleanDifference',
    kind: vscode.CompletionItemKind.Function,
    detail: 'BooleanDifference(tag) = { ObjectList } { ToolList };',
    documentation: '**BooleanDifference** (OCC): Subtracts tool entities from object entities.\n\n```gmsh\nBooleanDifference(1) = { Volume{1}; Delete; } { Volume{2}; Delete; };\n```',
    insertText: 'BooleanDifference(${1:1}) = { ${2:Volume}{${3:1}}; Delete; } { ${4:Volume}{${5:2}}; Delete; };'
  },
  {
    label: 'BooleanUnion',
    kind: vscode.CompletionItemKind.Function,
    detail: 'BooleanUnion(tag) = { ObjectList } { ToolList };',
    documentation: '**BooleanUnion** (OCC): Computes the solid union of objects and tools.',
    insertText: 'BooleanUnion(${1:1}) = { ${2:Volume}{${3:1}}; Delete; } { ${4:Volume}{${5:2}}; Delete; };'
  },
  {
    label: 'BooleanIntersection',
    kind: vscode.CompletionItemKind.Function,
    detail: 'BooleanIntersection(tag) = { ObjectList } { ToolList };',
    documentation: '**BooleanIntersection** (OCC): Computes the intersection of objects and tools.',
    insertText: 'BooleanIntersection(${1:1}) = { ${2:Volume}{${3:1}}; Delete; } { ${4:Volume}{${5:2}}; Delete; };'
  },
  {
    label: 'BooleanFragments',
    kind: vscode.CompletionItemKind.Function,
    detail: 'BooleanFragments(tag) = { ObjectList } { ToolList };',
    documentation: '**BooleanFragments** (OCC): Computes all non-manifold intersections and conformal sub-shapes.',
    insertText: 'BooleanFragments(${1:1}) = { ${2:Volume}{${3:1}}; Delete; } { ${4:Volume}{${5:2}}; Delete; };'
  },

  // Physical Groups
  {
    label: 'Physical Point',
    kind: vscode.CompletionItemKind.Class,
    detail: 'Physical Point("name", tag) = {points};',
    documentation: '**Physical Point**: Defines a named or numbered boundary/mesh physical group of points.\n\n```gmsh\nPhysical Point("LoadPoint", 1) = {1};\n```',
    insertText: 'Physical Point("${1:name}", ${2:tag}) = {${3:points}};'
  },
  {
    label: 'Physical Curve',
    kind: vscode.CompletionItemKind.Class,
    detail: 'Physical Curve("name", tag) = {curves};',
    documentation: '**Physical Curve**: Defines a named or numbered physical group of curves (e.g., for boundary conditions).\n\n```gmsh\nPhysical Curve("Inlet", 1) = {1, 2};\n```',
    insertText: 'Physical Curve("${1:name}", ${2:tag}) = {${3:curves}};'
  },
  {
    label: 'Physical Surface',
    kind: vscode.CompletionItemKind.Class,
    detail: 'Physical Surface("name", tag) = {surfaces};',
    documentation: '**Physical Surface**: Defines a named or numbered physical group of surfaces.\n\n```gmsh\nPhysical Surface("Walls", 1) = {1, 2, 3};\n```',
    insertText: 'Physical Surface("${1:name}", ${2:tag}) = {${3:surfaces}};'
  },
  {
    label: 'Physical Volume',
    kind: vscode.CompletionItemKind.Class,
    detail: 'Physical Volume("name", tag) = {volumes};',
    documentation: '**Physical Volume**: Defines a named or numbered 3D physical domain group for simulation solvers.\n\n```gmsh\nPhysical Volume("Domain", 1) = {1};\n```',
    insertText: 'Physical Volume("${1:name}", ${2:tag}) = {${3:volumes}};'
  },

  // Mesh Controls
  {
    label: 'MeshSize',
    kind: vscode.CompletionItemKind.Property,
    detail: 'MeshSize {points} = size;',
    documentation: '**MeshSize**: Assigns prescribed mesh element length to specific points.\n\n```gmsh\nMeshSize {1, 2} = 0.05;\n```',
    insertText: 'MeshSize {${1:points}} = ${2:size};'
  },
  {
    label: 'Transfinite Curve',
    kind: vscode.CompletionItemKind.Method,
    detail: 'Transfinite Curve {curves} = n_nodes [Using Progression p];',
    documentation: '**Transfinite Curve**: Discretizes curves with a regular structured node distribution.\n\n```gmsh\nTransfinite Curve {1, 2} = 20 Using Progression 1.1;\n```',
    insertText: 'Transfinite Curve {${1:curves}} = ${2:nPoints};'
  },
  {
    label: 'Transfinite Surface',
    kind: vscode.CompletionItemKind.Method,
    detail: 'Transfinite Surface {surfaces} [= {corners}];',
    documentation: '**Transfinite Surface**: Creates structured 2D quad/tri mesh on 3- or 4-sided surfaces.\n\n```gmsh\nTransfinite Surface {1};\n```',
    insertText: 'Transfinite Surface {${1:surfaces}};'
  },
  {
    label: 'Recombine Surface',
    kind: vscode.CompletionItemKind.Method,
    detail: 'Recombine Surface {surfaces};',
    documentation: '**Recombine Surface**: Merges triangles into quadrangles to generate pure quad or quad-dominant meshes.\n\n```gmsh\nRecombine Surface {1};\n```',
    insertText: 'Recombine Surface {${1:surfaces}};'
  },
  {
    label: 'Coherence',
    kind: vscode.CompletionItemKind.Keyword,
    detail: 'Coherence;',
    documentation: '**Coherence**: Removes duplicated geometric entities that occupy the same coordinates.',
    insertText: 'Coherence;'
  },

  // Control Flow & Utility
  {
    label: 'For',
    kind: vscode.CompletionItemKind.Snippet,
    detail: 'For i In {start:end} ... EndFor',
    documentation: '**For Loop**: Iterates index over a range or array.\n\n```gmsh\nFor i In {1:5}\n  Point(i) = {i, 0, 0};\nEndFor\n```',
    insertText: 'For ${1:i} In {${2:1}:${3:10}}\n  $0\nEndFor'
  },
  {
    label: 'If',
    kind: vscode.CompletionItemKind.Snippet,
    detail: 'If (cond) ... EndIf',
    documentation: '**If Condition**: Conditional block execution.\n\n```gmsh\nIf (dim == 3)\n  Volume(1) = {1};\nEndIf\n```',
    insertText: 'If (${1:condition})\n  $0\nEndIf'
  },
  {
    label: 'Printf',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Printf("fmt", ...);',
    documentation: '**Printf**: Prints formatted text and variable values to Gmsh log / console.\n\n```gmsh\nPrintf("Radius: %g", r);\n```',
    insertText: 'Printf("${1:%g}", ${2:var});'
  },
  {
    label: 'Sprintf',
    kind: vscode.CompletionItemKind.Function,
    detail: 'Sprintf("fmt", ...)',
    documentation: '**Sprintf**: Formats a string with arguments.\n\n```gmsh\nname$ = Sprintf("curve_%g", i);\n```',
    insertText: 'Sprintf("${1:%g}", ${2:var})'
  },
  {
    label: 'Include',
    kind: vscode.CompletionItemKind.Keyword,
    detail: 'Include "filename.geo";',
    documentation: '**Include**: Inserts and evaluates an external Gmsh script file.',
    insertText: 'Include "${1:file.geo}";'
  },

  // Constants & Options
  {
    label: 'Pi',
    kind: vscode.CompletionItemKind.Constant,
    detail: 'Pi = 3.141592653589793',
    documentation: 'Mathematical constant Pi (Gmsh built-in constant).'
  },
  {
    label: 'Mesh.Algorithm',
    kind: vscode.CompletionItemKind.Variable,
    detail: 'Mesh.Algorithm = 1..11;',
    documentation: '2D mesh algorithm: 1=MeshAdapt, 2=Automatic, 3=Initial, 5=Delaunay, 6=Frontal-Delaunay, 7=BAMG, 8=Frontal-Delaunay for Quads, 9=Packing of Parallelograms, 11=Quasi-structured Quad.'
  },
  {
    label: 'Mesh.ElementOrder',
    kind: vscode.CompletionItemKind.Variable,
    detail: 'Mesh.ElementOrder = 1 | 2;',
    documentation: 'Mesh polynomial order (1: linear elements, 2: quadratic elements with mid-side nodes).'
  },
  {
    label: 'Mesh.CharacteristicLengthMin',
    kind: vscode.CompletionItemKind.Variable,
    detail: 'Mesh.CharacteristicLengthMin = size;',
    documentation: 'Minimum element size constraint for meshing.'
  },
  {
    label: 'Mesh.CharacteristicLengthMax',
    kind: vscode.CompletionItemKind.Variable,
    detail: 'Mesh.CharacteristicLengthMax = size;',
    documentation: 'Maximum element size constraint for meshing.'
  }
];

/**
 * Provides autocomplete suggestions for Gmsh (.geo) files
 */
export class GmshCompletionItemProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);
    // Avoid triggering intrusive autocompletion inside line comments
    if (linePrefix.trimStart().startsWith('//')) {
      return [];
    }

    const items: vscode.CompletionItem[] = [];

    // 1. Built-in Gmsh commands & keywords
    for (const cmd of GMSH_COMMANDS) {
      const item = new vscode.CompletionItem(cmd.label, cmd.kind);
      item.detail = cmd.detail;
      item.documentation = new vscode.MarkdownString(cmd.documentation);
      if (cmd.insertText) {
        item.insertText = new vscode.SnippetString(cmd.insertText);
      }
      items.push(item);
    }

    // 2. Scan current document for user-defined variables and arrays
    const text = document.getText();
    const varRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)(?:\[\])?\s*=/g;
    const seenVars = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = varRegex.exec(text)) !== null) {
      const varName = match[1];
      // Skip keywords that look like assignment
      if (
        ['Point', 'Line', 'Circle', 'Spline', 'BSpline', 'Bezier', 'Curve', 'Surface', 'Volume', 'Box', 'Sphere', 'Cylinder', 'MeshSize'].includes(varName)
      ) {
        continue;
      }
      if (!seenVars.has(varName)) {
        seenVars.add(varName);
        const varItem = new vscode.CompletionItem(varName, vscode.CompletionItemKind.Variable);
        varItem.detail = `(User Variable) ${varName}`;
        varItem.documentation = new vscode.MarkdownString(`User-defined variable \`${varName}\` in current document.`);
        items.push(varItem);
      }
    }

    return items;
  }
}

/**
 * Provides hover documentation when hovering over Gmsh symbols
 */
export class GmshHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.Hover> {
    const range = document.getWordRangeAtPosition(position, /[\w.]+/);
    if (!range) {
      return null;
    }

    let word = document.getText(range);

    // Also check two-word compound keywords like "Curve Loop", "Plane Surface", "Surface Loop"
    const line = document.lineAt(position.line).text;
    const compoundPatterns = [
      'Curve Loop',
      'Plane Surface',
      'Surface Loop',
      'Physical Point',
      'Physical Curve',
      'Physical Surface',
      'Physical Volume',
      'Transfinite Curve',
      'Transfinite Surface',
      'Recombine Surface'
    ];

    for (const compound of compoundPatterns) {
      const startIdx = line.indexOf(compound);
      if (startIdx !== -1) {
        const endIdx = startIdx + compound.length;
        if (position.character >= startIdx && position.character <= endIdx) {
          word = compound;
          break;
        }
      }
    }

    const found = GMSH_COMMANDS.find(
      (c) => c.label.toLowerCase() === word.toLowerCase()
    );

    if (found) {
      const contents = new vscode.MarkdownString();
      contents.appendMarkdown(`### Gmsh: \`${found.label}\`\n\n`);
      contents.appendCodeblock(found.detail, 'gmsh');
      contents.appendMarkdown(`\n${found.documentation}`);
      return new vscode.Hover(contents);
    }

    return null;
  }
}

/**
 * Registers all Gmsh language support providers
 */
export function registerGmshLanguageSupport(context: vscode.ExtensionContext) {
  const GMSH_SELECTOR: vscode.DocumentSelector = [
    { language: 'gmsh', scheme: 'file' },
    { pattern: '**/*.geo', scheme: 'file' },
    { pattern: '**/*.msh', scheme: 'file' }
  ];

  // 1. Completion Provider
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      GMSH_SELECTOR,
      new GmshCompletionItemProvider(),
      '.', '{', '(', '='
    )
  );

  // 2. Hover Provider
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      GMSH_SELECTOR,
      new GmshHoverProvider()
    )
  );
}
