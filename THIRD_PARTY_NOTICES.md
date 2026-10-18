# AVISOS DE TERCEIROS E LICENÇAS / THIRD-PARTY NOTICES

A CALDRA é um software industrial proprietário.
Os componentes de terceiros utilizados mantêm seus respectivos direitos autorais e licenças originais, conforme detalhado abaixo.

---

## 1. Three.js
- **Repositório**: https://github.com/mrdoob/three.js
- **Licença**: MIT License
- **Copyright**: (c) 2010-2026 Three.js Authors
- **Uso na CALDRA**: Renderização visual 3D em WebGL, iluminação técnica, materiais PBR, câmera e visualização em viewport.

```
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.
```

---

## 2. Open CASCADE Technology (OCCT) & occt-wasm
- **Repositório occt-wasm**: https://github.com/andymai/occt-wasm
- **Bindings TypeScript / WASM Adapter**: MIT License ou Apache License 2.0 (Copyright (c) Andy Aragon / andymai)
- **Kernel Geométrico Base (OCCT)**: GNU Lesser General Public License, version 2.1 (LGPL-2.1) com OPEN CASCADE Technology Public License Exception
- **Uso na CALDRA**: Motor geométrico de modelagem sólida B-Rep (Boundary Representation), primitivas, operações booleanas (Fuse, Cut, Common), extrusão, revolução, concordâncias (Fillet), chanfros (Chamfer) e tesselação.
- **Isolamento Arquitetural**: O CALDRA CAD CORE atua como camada de abstração (Bridge/Adapter). O código proprietário da CALDRA NÃO é derivado nem relicenciado como LGPL/GPL. O binário WebAssembly (`occt-wasm.wasm`) é consumido dinamicamente como módulo externo substituível, preservando estritamente os requisitos de substituição de biblioteca dinâmica da LGPL-2.1.
- **Status Jurídico**: `LEGAL_REVIEW_REQUIRED` para validação formal de termos e distribuição em canais proprietários.

---

## 3. Comlink
- **Repositório**: https://github.com/GoogleChromeLabs/comlink
- **Licença**: Apache License 2.0
- **Uso na CALDRA**: Comunicação RPC assíncrona entre o thread principal do navegador e Web Workers para operações CAD pesadas sem bloqueio da UI.
