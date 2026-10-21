# F1 2025 · GP de São Paulo

Jogo de corrida de F1 no navegador, grid de 2025, no Autódromo José Carlos Pace (Interlagos). Three.js, sem servidor: é só abrir o `index.html` num servidor estático.

- **PC:** W/S acelera e freia, A/D esterça, Espaço abre a asa (DRS), E usa o ERS, C troca a câmera, R volta à pista, Esc pausa. Controle (gamepad) também funciona.
- **Celular:** arraste na metade esquerda da tela para esterçar; freio, gás e DRS à direita; botão CAM troca a câmera. Jogue com o celular deitado.

Rodar localmente:

```bash
python3 -m http.server 8777
```

e abrir `http://localhost:8777`.

Regras técnicas e roteiro de testes: `PADRAO.md` e `qa.js`.

## Créditos e licenças

Jogo de fã, sem fins comerciais e sem relação oficial com a Fórmula 1, a FIA, as equipes ou os patrocinadores. Nomes, marcas e pinturas pertencem aos seus donos.

- Modelos 3D dos carros: **Redgrund** no Sketchfab, licença [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modificados (escala, rodas separadas, menos polígonos). A Mercedes e a Haas usam o modelo da Aston Martin repintado.
  - [Aston Martin AMR23](https://sketchfab.com/3d-models/f6ba825a43b146a9b669934a4e1fd529) · [Ferrari SF-23](https://sketchfab.com/3d-models/ecb0f812bc454331bbe721655b0780ec) · [McLaren MCL60](https://sketchfab.com/3d-models/8340e27c325345e4aa92a6a31cc34b1e) · [Red Bull RB19](https://sketchfab.com/3d-models/e4afe46f3aab4b23a418da06fc163821)
- Céu (HDRI `kloofendal_48d_partly_cloudy_puresky`) e texturas de asfalto, grama e brita: [Poly Haven](https://polyhaven.com), CC0.
- Biblioteca 3D: [three.js](https://threejs.org) r128 (MIT).
