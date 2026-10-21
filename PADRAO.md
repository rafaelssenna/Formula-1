# Padrão do jogo (vale para toda pista e todo carro novo)

Este arquivo define como as coisas devem ser feitas e como conferir antes de publicar.
Nada vai pro ar sem passar no **Roteiro de QA** do fim.

## 1. Unidades e referenciais

- Metros, segundos, quilos, radianos. Velocidade interna em m/s; km/h só na tela.
- Mundo: Y para cima. A pista é uma curva Catmull-Rom amostrada em `N` pontos (`T.p`, `T.t`, `T.n`, `T.y`), espaçamento `T.ds` (~1,9 m).
- **Altura da pista sempre interpolada** com `heightAt(x,z,i)`. Nunca usar `T.y[i]` direto pra posicionar algo que se move: dá degrau de 10 a 20 cm em subida.
- Busca de índice (`nearest`) **sempre ancorada no índice físico do carro** (`sIdx`). Interlagos tem trechos vizinhos em alturas diferentes; uma busca solta "pula" pro trecho errado.
- Carro: `pos` é o **eixo traseiro** (modelo bicicleta). Entre-eixos 3,6 m. A malha fica 1,85 m à frente de `pos`.
- Malha do carro: frente = +X local, ordem de rotação `YZX` (guinada, depois arfagem em Z, depois rolagem em X).

## 2. Física: alvos de calibração

Valores de referência de um F1 2025. Se uma mudança tirar algum destes da faixa, ela está errada.

| Medida | Alvo | Como medir |
|---|---|---|
| Frenagem 300 → 100 km/h | 1,8 a 2,1 s, 90 a 105 m, sem travar | `QA.checks()` |
| Velocidade máxima (DRS fechado) | 320 a 340 km/h | telemetria do líder |
| Volta da IA em Interlagos | 1:10 a 1:20 | melhor volta após 3 voltas |
| IA fora da pista | 0 s por volta nos 10 primeiros | `offTrack` |
| Pneus | 80 a 110 °C em ritmo | HUD |

Regras:
- Círculo de atrito só com força de pneu (motor, freio, curva). Arrasto e gravidade ficam fora.
- Freio no limite do grip (0,98 × Fmax). Trava só se somar com curva ou na grama.
- Guinada limitada pelo grip dianteiro: volante todo em alta dá subesterço, não pião.
- Gravidade na rampa entra na força longitudinal (subida freia, descida empurra).
- Mureta: impulso na normal (restituição 0,25), atrito na tangente, dano pela velocidade normal. Nunca teleportar o carro.
- O carro se apoia nos **dois eixos**: altura = média das alturas da pista sob cada eixo; arfagem = inclinação entre eles.

### Assistências (padrão ligadas; o teclado é tudo ou nada)
- **Direção:** A/D pedem uma curvatura, limitada a 92% do que o pneu aguenta naquela velocidade. Volante todo nunca vira subesterço.
- **Frenagem:** se a velocidade passa da que permite fazer o trecho à frente (perfil de velocidade × 0,95), freia sozinho e corta o acelerador.
- ABS, controle de tração, câmbio automático e linha de corrida também vêm ligados.

### Celular
- `<meta name="viewport" content="width=device-width,...">` obrigatório (sem ele o celular desenha em 980 px e encolhe tudo).
- Direção por arraste na metade esquerda (analógica, 70 px = volante todo), freio/gás/DRS à direita. Acelerador automático ligado por padrão no toque.
- Controles de toque só aparecem durante a corrida; em pé mostra "gire o celular".
- Telas baixas (≤ 520 px de altura): classificação só com top 3 e vizinhos, minimapa 96 px, sem painel de pneus.
- Celular: resolução ×1,5, sombra 2048, sem pós-processamento, só modelos de baixo detalhe.
- **Proporção da câmera vem do canvas na tela (`clientWidth/clientHeight`) e é conferida todo quadro.** Nunca só no evento `resize`: no celular ele chega antes do tamanho final ao girar e a imagem fica esticada.
- Menu no celular: compacto, sem textos longos, botão Largar fixo no rodapé.
- Teste obrigatório: abrir em pé, girar para deitado, conferir `camera.aspect == canvas.clientWidth/clientHeight`.

### Som do motor (V6 1.6 turbo)
- Onda periódica de um ciclo (720°, 6 explosões, bancos com leve assimetria); fundamental = rpm/120, pico = explosão rpm/20.
- Aceite (medido com analisador): pico dominante em rpm/20 ± 2 Hz em 6.000, 10.000 e 11.800 rpm; componente 1,5× presente.
- Camadas: escapamento com formantes fixos (420/1250/2900 Hz), ruído de combustão modulado na explosão, turbo com atraso, MGU-K, limitador, corte de 35 ms na troca, estalos ao tirar o pé, zebra, vento, pneu.
- 3 carros mais próximos da câmera com voz própria, Doppler e pan.

### Rodas em velocidade
- Giro visual limitado a 0,45 rad/quadro; acima de ~45 km/h um disco de borrão (simétrico, com a faixa do composto) aparece na face externa do pneu, opaco a partir de ~120 km/h. Evita o efeito estroboscópico (roda parada ou girando ao contrário).

## 3. Modelos de carro

Pipeline: `tools/prepare-car.mjs entrada.glb assets/cars nome` gera `nome_hi.glb` e `nome_lo.glb`. Depois `tools/glb2json.mjs assets/cars/*.glb` gera os `.json` que o jogo carrega (artifacts não servem `.glb`; glTF em JSON com dados embutidos é o mesmo modelo).

O script faz, nesta ordem:
1. Baixa transformações, normaliza largura em 2,0 m, chão em y=0, frente em +Z.
2. Detecta eixos pelo par de picos com entre-eixos de 3,2 a 3,9 m.
3. Separa rodas por conectividade a partir da face externa do pneu.
4. **Centro da roda**: raio vem da roda traseira (pneus 2022+ têm o mesmo diâmetro, 720 mm). Centro dianteiro sai do ponto de contato com o chão, refinado por busca de ±20 mm minimizando a excentricidade.
5. Tudo além do raio do pneu + 12 mm volta pro chassi (defletores e dutos não giram).
6. Grava o centro em `extras.wheelCenter` (a quantização reescreve a posição dos nós; não confiar nela).
7. LOD alto (~170 mil triângulos, textura 2k) e baixo (~50 mil, 512); celular carrega só o baixo.

Aceite: excentricidade de roda abaixo de 15 mm no modelo leve e 10 mm no completo (medida com todos os vértices). Rodas são simplificadas com erro 5× menor que o chassi (`QA.checks()`), carro tocando o chão nas quatro rodas.

## 4. Pista e cenário

- Asfalto, grama e brita com texturas PBR (cor, normal, rugosidade) da Poly Haven (CC0).
- Céu e luz pelo HDRI. A direção do sol sai do pixel mais claro do HDRI.
- **Terreno nunca acima de nenhum trecho num raio de 260 m**: altura limitada a `y_pista − 0,9 + max(0, d − (HW+18))/3`.
- Faixa de grama colada na pista vai só até a mureta (HW + 15,2 m). Faixa larga invade trechos vizinhos.
- Plano de chão distante fica abaixo do ponto mais baixo da pista.
- Cenário de fundo: prédios instanciados (cidade), nunca morros lisos.
- Árvores e prédios: `InstancedMesh`. Cores hex sempre passam por `srgb()`.
- Nada a menos de HW + 26 m da pista além de muretas, placas, zebras e área de escape.

## 5. Câmeras

- Câmeras de bordo (T-cam, cockpit, bico) são presas à malha do carro com `localToWorld`, para o pneu nunca se mexer na tela.
- Tremor só nas câmeras externas.
- T-cam: local (−0,15; 1,62; 0), olhando para (22; −0,1; 0), FOV 60.

## 5b. Carregamento no artifact (segurança restrita)
- O artifact bloqueia downloads de endereços `data:` e `blob:`. O carregador padrão do Three.js usa `data:` para os modelos .json e falhava em silêncio (carros quadradões).
- `loadCarGLTF()` decodifica binário e imagens no próprio código (base64 → bytes → GLB em memória; imagens via `createImageBitmap`), sem nenhum download além do .json. Texturas WebP ficam em `extensions.EXT_texture_webp.source`.
- O menu mostra "Carros 3D: X/10 carregados" e o erro, se houver. Sempre conferir.
- Teste obrigatório: rodar o jogo numa cópia com `<meta http-equiv="Content-Security-Policy" content="connect-src 'self'; img-src 'self'">` no topo (`csp-test.html`) e conferir 20/20 carros 3D com pintura.

## 5c. Desempenho (meta: celular < 100 chamadas de desenho e < 500 mil triângulos por quadro)
- `mergeStatic()` roda depois de montar o cenário: junta malhas paradas com o mesmo material (pela assinatura do material, não pelo objeto) em blocos de 500 m. Objeto que muda em jogo leva `userData.noMerge=true` (luzes da largada, linha de corrida, céu, água).
- Não criar material/textura repetidos: `textTex` tem cache; arquibancada usa um material de torcida só (repetição no UV).
- Carros: `bakeCarModel()` junta as peças na carga (carroceria = 1 malha, cada roda = 1). Três níveis de detalhe: hi (perto), lo (48 m), vlo (~15 mil triângulos, 150 m). Celular: lo e vlo (35 m).
- Celular: resolução ×1,25 com ajuste dinâmico (cai até 0,6 se ficar abaixo de 50 fps; ignora aba oculta), sombra só do carro do jogador (1024), pintura sem verniz, árvores e prédios pela metade, terreno mais simples.
- Medir com `renderer.info` antes e depois de qualquer mudança visual.
| Medida | PC | Celular |
|---|---|---|
| Chamadas de desenho | ~300 | 31–50 |
| Triângulos | ~3 milhões | 340–420 mil |

## 5d. Cenário de Interlagos
- Área interna: só grama, árvores e os dois lagos (gerados nos pontos mais distantes da pista dentro do traçado). Prédios só fora do traçado.
- Grama com faixas de corte (9 m). Árvores em verde-oliva escuro (saturação baixa).
- Grid de largada pintado na mesma posição usada pelo `setup()`.
- PC: gradação de cor de transmissão (contraste, saturação, sol quente, vinheta) depois da correção gamma.

## 6. Código

- Comentário no meio de uma linha de código: só `/* ... */`. Um `//` no meio da linha apaga o resto dela (já quebrou o jogo duas vezes).
- Nunca reutilizar nome de variável global em escopo local (`fx` escondeu o sistema de partículas).
- `node --check` no JS extraído antes de qualquer teste.

## 7. Roteiro de QA (obrigatório antes de publicar)

No console da página, com a corrida criada:

```js
const s=document.createElement('script');s.src='qa.js?'+Date.now();document.head.appendChild(s);
QA.sim(9);                       // passa as luzes de largada
await QA.checks();               // erros, carros apoiados, rodas, frenagem
await QA.film(32,[1]);           // volta inteira em T-cam, 32 quadros
await QA.film(12,[0,3,5,2,4],'mix');  // câmeras e carros variados
await QA.kbBot(200);             // piloto de teclado com as assistências padrão
```

Critérios para publicar:
- `erros` vazio, `carrosApoiados` 20/20, `rodaExcentricidade_mm` < 10, frenagem na faixa.
- `bloqueados` vazio na volta filmada (nada a menos de 10 m da câmera).
- `kbBot`: 0 s fora da pista, sem dano, volta abaixo de 1:30 com as assistências padrão (com tráfego).
- Olhar a grade: asfalto visível em todo quadro, nada verde sobre a pista, nenhum objeto flutuando, carros com sombra no chão.
- 60 fps ou mais no PC com o painel visível.

`QA` usa `__dbg.tick`, então funciona mesmo com a aba em segundo plano.

## 8. Origem dos arquivos

- Carros: modelos de Redgrund no Sketchfab (CC BY), baixados do repositório público `gaohaoting/F1Match_Demo` (GitHub, LFS). Os .glb originais não ficam aqui; para regenerar, baixar de novo e rodar `tools/prepare-car.mjs` e `tools/glb2json.mjs` (`cd tools && npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer sharp gl-matrix`).
- HDRI `kloofendal_48d_partly_cloudy_puresky` e texturas `asphalt_track`, `leafy_grass`, `gravelly_sand`: Poly Haven (CC0). O HDRI vira PNG com `tools/hdr2png.py`.
- Para testar local: `python3 -m http.server 8777` nesta pasta e abrir `http://localhost:8777`.
