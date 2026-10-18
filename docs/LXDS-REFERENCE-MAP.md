# LXDS REFERENCE MAP — CypCut 6.3.907.9

Referência técnica derivada de UM arquivo real (`CYPCT_GOLDEN_SAMPLE_01`,
cone excêntrico p01). Documento de leitura: o CALDRA **não escreve LXDS**.

## 1. Contêiner

```
.lxds  =  ZIP (nesta amostra: todas as partes STORE, sem compressão)
├── info.xml                 aplicação, versão, autor, data
├── content.xml              raiz do documento + tabela de handles
├── Model2D/content.xml      modelo ativo: extensões + lista de shapes
├── Model2D/thumbnail.emf    miniatura vetorial (EMF)
├── Shapes2D/content.xml     índice das entidades (handle, classe, layer, endereços)
├── Shapes2D/data.bin        blob binário das entidades
├── Geometry2D/content.xml   apenas MD5
├── Geometry2D/data.bin      blob binário da geometria
├── Layers/content.xml       tabela de layers
├── Technical/content.xml    parâmetros de processo (canal, corte, pierce, lead)
├── TextStyles/content.xml   estilos de texto (vazio nesta amostra)
└── Viewports/content.xml    estado de visualização
```

## 2. Cadeia de referências

```
content.xml (Header HandleSeed, ID)
   ├─ Technical  Handle=2
   ├─ Viewports  Handle=3
   ├─ Blocks     Handle=4
   ├─ Layers     Handle=5
   ├─ TextStyles Handle=6
   └─ Portions   Handle=12  ActiveModelID={GUID}
                     ↓
        Model2D/content.xml  Handle=13, ID={GUID}
             ExtMin / ExtMax (mm)
             Shapes → <Shape Class="LwPolyline" Handle="1055">
                     ↓  (mesmo handle)
        Shapes2D/content.xml
             <LwPolyline Handle="1055" LayerName="MARK"
                         DataAddr="4096" GeoAddr="4096"/>
                     ↓ endereços (offset em bytes)
        Shapes2D/data.bin   e   Geometry2D/data.bin
```

- A entidade referencia a layer pelo **nome** (`LayerName`), não pelo handle.
- `DataAddr` / `GeoAddr` são offsets nos blobs binários.
- `Shapes2D` e `Geometry2D` trazem MD5 do respectivo blob — **qualquer escrita
  exigiria recalcular esses hashes**, e a estrutura interna dos blobs não está
  compreendida. Por isso não existe exportador LXDS.

## 3. Layers

```xml
<Layer Handle="1001" Name="CUT"  LayerFlag="768" Color="255"/>
<Layer Handle="1002" Name="MARK" LayerFlag="768" Color="16711680"/>
```

Nomes em MAIÚSCULAS, sem acento — mesma convenção adotada pelo DXF CNC do
CALDRA (`CUT` / `MARK` / `BEND`). Cor é inteiro BGR, **não** é instrução de
fabricação.

## 4. Technical (o que o DXF não carrega)

`Channels > Channel > CamParams` e filhos:
`LeadLineParam`, `LayerCutParams`, `CornerParams`, `SuperCut`, `SlopeCutParams`,
`Cut`, `SlowEndExt`, `SlowLeadExt`, `Pierce1..Pierce9`, `MaterialParams`,
`PwmFreqFunc`, `PwmRatioFunc`.

Exemplos: `WorkSpeed`, `CutGap`, `MicroLen`, `LiftHeight`, `ArcTolerance`,
`CornerTolerance`, potência/frequência/razão PWM, pressão de gás, alturas e
tempos de perfuração, parâmetros de lead.

**Conclusão de arquitetura:** parâmetros de processo pertencem ao LXDS, não ao
DXF. O CALDRA envia geometria + intenção (layer, ordem, direção, start point,
lead) e a máquina aplica sua própria configuração de processo.

## 5. Limites conhecidos

- Uma amostra só: não generalizar versões, flags nem classes de entidade.
- Blobs binários não decodificados — proibido reconstruir por tentativa e erro.
- Sem campo explícito de sequência no índice XML desta amostra.
