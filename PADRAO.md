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
| Pneu e aerodinâmica | atrito 2,0; ClA 5,0 m² (DRS −0,9); CdA 1,05 | constantes `MU0`, `CLA` |
| Aceleração lateral | ~2,3 g a 100 km/h; ~5 g a 250 km/h | fórmula `MU0·(g + ½ρ·ClA·v²/m)` |
| Frenagem 300 → 100 km/h | 1,3 a 1,7 s, 55 a 80 m, sem travar (na reta dos boxes) | `QA.checks()` |
| Arrancada 0-100 / 0-200 / 0-300 | ~2,6 / ~4,7 / ~8,3 s (tração só no eixo traseiro, `REAR` 0,56) | cronometrar o líder na largada |
| Velocidade máxima | 320 a 345 km/h (reta de 1,1 km de Sakhir) | telemetria da IA |
| Volta ideal (perfil) | ~1:35 (pole real 2025: 1:29,8) | soma `ds/VPROF` |
| IA Médio | melhor ~1:38, mediana ~1:41; 0 s fora | `QA.raceStats()` |
| Pneus em ritmo | 95 a 110 °C (asfalto `TRACK_TEMP` 42 °C) | `temp` dos carros |
| Jogador com assistências (bot de teclado) | ~1:42, 0 s fora sozinho | `QA.kbBot()` |
| Corrida neutra de 4 min | ~10 contatos (maioria na largada), ≤ 3 asas quebradas | `QA.raceStats()` |
| Pit lane (entrada→saída, com parada) | 25 a 28 s | log "saiu do box" |

Regras:
- Carro e pneu iguais para todos; só `TEAMS[].pace` muda a aderência (diferença entre equipes). A dificuldade muda o quão perto do limite a IA pilota, nunca a aderência.
- Perfil de velocidade (`VPROF`) usa a curvatura da trajetória realmente seguida (`KLINE`, linha de corrida medida em ±15 m) e motor + ERS (120 kW). Acima de ~1,10 de fator a IA passa do limite: não subir as dificuldades além disso.
- Círculo de atrito só com força de pneu (motor, freio, curva). Arrasto e gravidade ficam fora.
- Freio no limite do grip (0,98 × Fmax). Trava só se somar com curva ou na grama.
- Guinada limitada pelo grip dianteiro: volante todo em alta dá subesterço, não pião.
- Gravidade na rampa entra na força longitudinal (subida freia, descida empurra).
- Mureta: impulso na normal (restituição 0,25), atrito na tangente, dano pela velocidade normal. Nunca teleportar o carro.
- Carro x carro: caixas orientadas 5,5 × 2,0 m, impulso no ponto de contato (restituição 0,15, atrito 0,35), giro pelo braço de alavanca (`yawRate`, amortecido pelos pneus). Asa dianteira quebra acima de ~14 km/h de impacto frontal e tira até 35% do downforce.
- O carro se apoia nos **dois eixos**: altura = média das alturas da pista sob cada eixo; arfagem = inclinação entre eles.

### IA em tráfego
- Mantém intervalo de ~0,22 s (+6,5 m entre eixos) do carro da frente na mesma faixa; ultrapassa pelo lado livre; lado a lado nunca fecha (2,9 m de separação).
- Largada: cada carro fica na sua fila do grid por ~7 s; desvia de carro muito mais lento mesmo nesse período.

### Comissários (FIA) — base: diretrizes de penalidades F1 2025 (FIA, 14/05/2025)
- Só pune quem for **total ou predominantemente culpado**; responsabilidade dividida = incidente de corrida, sem ação.
- Investigação quando o toque passa de 2,2 m/s. Culpado: quem estava atrás numa batida traseira, ou quem se moveu lateralmente para cima do outro.
- **Causar colisão:** 10 s (base); 5 s com atenuante (1ª volta nos primeiros 25 s, ou impacto < 5 m/s). **Sem consequência esportiva** (vítima não rodou, não saiu, sem dano, impacto ≤ 8 m/s): advertência.
- **Empurrar para fora sem toque:** vítima sai da pista com o rival colado vindo na direção dela = 10 s / 5 s. A vítima não toma limite de pista.
- **Sair da pista e ganhar posição (jogador):** 10 s para devolver; senão +10 s.
- **Limites de pista:** volta anulada; 3ª = bandeira preta e branca; 4ª em diante = +5 s cada. Não conta se foi empurrado/batido para fora (espera 0,6 s).
- IA defende com **um** movimento só (mais de um = 5 s na regra real).

### Disputa
- Vácuo: até −30% de arrasto colado atrás na mesma linha (8–40 m). Ar sujo: até −25% de downforce colado em curva (6–28 m).
- IA colada atrás freia mais cedo (0,68 em vez de 0,8 do limite) e abre distância quando o da frente freia.
- HUD mostra o intervalo para o carro da frente e de trás e "VÁCUO".

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

- **Traçado real:** linha central da base TUMFTM racetrack-database (`Sakhir.csv`, LGPL-3.0; Interlagos era `SaoPaulo.csv`), 5.404 m, 1 ponto a cada ~15 m. Altimetria aproximada por distância (`ELEV`). Curvas detectadas pela curvatura (`CORNER_NAMES` vazio = Curva 1, 2...). Lado dos boxes `PS` calculado: o de dentro do traçado. Nunca voltar a pontos desenhados à mão (o traçado antigo se cruzava).
- **Nada a menos de HW+3 m de qualquer trecho:** `trackDist()` checa a pista inteira (grade de 40 m). `QA.scenery()` confere.

- Asfalto, grama e brita com texturas PBR (cor, normal, rugosidade) da Poly Haven (CC0).
- Céu e luz pelo HDRI. A direção do sol sai do pixel mais claro do HDRI.
- **Terreno nunca acima de nenhum trecho num raio de 260 m**: altura limitada a `y_pista − 0,9 + max(0, d − (HW+18))/3`.
- Faixa de grama colada na pista vai só até a mureta (HW + 15,2 m). Faixa larga invade trechos vizinhos.
- Plano de chão distante fica abaixo do ponto mais baixo da pista.
- Cenário de fundo: prédios instanciados (cidade), nunca morros lisos.
- Árvores e prédios: `InstancedMesh`. Cores hex sempre passam por `srgb()`. Copa: normais de esfera, sombra embaixo (cor de vértice) e textura de folhas vazada (`alphaTest`, dupla face): contorno de folhagem, nunca bola lisa.
- Nada a menos de HW + 26 m da pista além de muretas, placas, zebras e área de escape.

## 5. Câmeras

- Câmeras de bordo (T-cam, cockpit, bico) são presas à malha do carro com `localToWorld`, para o pneu nunca se mexer na tela.
- Tremor só nas câmeras externas.
- Avisos (`race.toast`) são uma faixa compacta de direção de prova logo abaixo do painel de tempo, nunca texto grande no meio da tela (cobre a pista).
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
- Celular: resolução ×2 com ajuste dinâmico (cai até 0,9 se ficar abaixo de 50 fps; ignora aba oculta; se baixar não acelerar, é teto de quadros — modo pouca energia do iPhone = 30 fps — e volta). Carro do jogador com o modelo completo (textura 2k), carregado na largada, sombra só do carro do jogador (1024), pintura sem verniz, árvores e prédios pela metade, terreno mais simples.
- Medir com `renderer.info` antes e depois de qualquer mudança visual.
| Medida | PC | Celular |
|---|---|---|
| Chamadas de desenho | ~300 | 31–50 |
| Triângulos | ~3 milhões | 340–420 mil |

## 5d. Cenário de Sakhir (Bahrein)
- Deserto: chão de areia clara (textura `gravel` tingida), sem árvores nem lagos; construções baixas cor de areia espalhadas longe da pista; Torre de Sakhir atrás dos boxes.
- Escape de asfalto (mais claro, grip 0,9) por fora das curvas; areia (grip 0,55) no resto até a mureta.
- Por dentro de grampo fechado (T1) a linha da mureta cruzaria a saída: mureta, alambrado e postes somem onde ficariam a menos de HW+6 m de outro trecho.
- Para trocar de pista: `RAW_XY`, `ELEV`, `CORNER_NAMES`, `S1/S2`, `DRS_ZONES`, `PIT`, arquibancadas, textos e `TRACK_TEMP`. O resto (perfil, IA, terreno, boxes) se ajusta sozinho.
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
