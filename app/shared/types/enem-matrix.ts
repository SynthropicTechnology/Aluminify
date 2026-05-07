export type AreaConhecimento =
  | "Linguagens, Códigos e suas Tecnologias"
  | "Matemática e suas Tecnologias"
  | "Ciências da Natureza e suas Tecnologias"
  | "Ciências Humanas e suas Tecnologias";

export interface CompetenciaEnem {
  codigo: string;
  descricao: string;
}

export interface HabilidadeEnem {
  codigo: string;
  descricao: string;
  competencia: string;
}

export interface AreaEnem {
  nome: AreaConhecimento;
  competencias: CompetenciaEnem[];
  habilidades: HabilidadeEnem[];
}

export const AREAS_CONHECIMENTO: AreaConhecimento[] = [
  "Linguagens, Códigos e suas Tecnologias",
  "Matemática e suas Tecnologias",
  "Ciências da Natureza e suas Tecnologias",
  "Ciências Humanas e suas Tecnologias",
];

export const ENEM_MATRIX: Record<AreaConhecimento, AreaEnem> = {
  "Linguagens, Códigos e suas Tecnologias": {
    nome: "Linguagens, Códigos e suas Tecnologias",
    competencias: [
      { codigo: "C1", descricao: "Aplicar as tecnologias da comunicação e da informação na escola, no trabalho e em outros contextos relevantes para sua vida." },
      { codigo: "C2", descricao: "Conhecer e usar língua(s) estrangeira(s) moderna(s) como instrumento de acesso a informações e a outras culturas e grupos sociais." },
      { codigo: "C3", descricao: "Compreender e usar a linguagem corporal como relevante para a própria vida, integradora social e formadora da identidade." },
      { codigo: "C4", descricao: "Compreender a arte como saber cultural e estético gerador de significação e integrador da organização do mundo e da própria identidade." },
      { codigo: "C5", descricao: "Analisar, interpretar e aplicar recursos expressivos das linguagens, relacionando textos com seus contextos, mediante a natureza, função, organização, estrutura das manifestações, de acordo com as condições de produção e recepção." },
      { codigo: "C6", descricao: "Compreender e usar os sistemas simbólicos das diferentes linguagens como meios de organização cognitiva da realidade pela constituição de significados, expressão, comunicação e informação." },
      { codigo: "C7", descricao: "Confrontar opiniões e pontos de vista sobre as diferentes linguagens e suas manifestações específicas." },
      { codigo: "C8", descricao: "Compreender e usar a língua portuguesa como língua materna, geradora de significação e integradora da organização do mundo e da própria identidade." },
      { codigo: "C9", descricao: "Entender os princípios, a natureza, a função e o impacto das tecnologias da comunicação e da informação na sua vida pessoal e social, no desenvolvimento do conhecimento, associando-os aos conhecimentos científicos, às linguagens que lhes dão suporte, às demais tecnologias, aos processos de produção e aos problemas que se propõem solucionar." },
    ],
    habilidades: [
      { codigo: "H1", descricao: "Identificar as diferentes linguagens e seus recursos expressivos como elementos de caracterização dos sistemas de comunicação.", competencia: "C1" },
      { codigo: "H2", descricao: "Recorrer aos conhecimentos sobre as linguagens dos sistemas de comunicação e informação para resolver problemas sociais.", competencia: "C1" },
      { codigo: "H3", descricao: "Relacionar informações geradas nos sistemas de comunicação e informação, considerando a função social desses sistemas.", competencia: "C1" },
      { codigo: "H4", descricao: "Reconhecer posições críticas aos usos sociais que são feitos das linguagens e dos sistemas de comunicação e informação.", competencia: "C1" },
      { codigo: "H5", descricao: "Associar vocábulos e expressões de um texto em LEM ao seu tema.", competencia: "C2" },
      { codigo: "H6", descricao: "Utilizar os conhecimentos da LEM e de seus mecanismos como meio de ampliar as possibilidades de acesso a informações, tecnologias e culturas.", competencia: "C2" },
      { codigo: "H7", descricao: "Relacionar um texto em LEM, as estruturas linguísticas, sua função e seu uso social.", competencia: "C2" },
      { codigo: "H8", descricao: "Reconhecer a importância da produção cultural em LEM como representação da diversidade cultural e linguística.", competencia: "C2" },
      { codigo: "H9", descricao: "Reconhecer as manifestações corporais de movimento como originárias de necessidades cotidianas de um grupo social.", competencia: "C3" },
      { codigo: "H10", descricao: "Reconhecer a necessidade de transformação de hábitos corporais em função das necessidades cinestésicas.", competencia: "C3" },
      { codigo: "H11", descricao: "Reconhecer a linguagem corporal como meio de interação social, considerando os limites de desempenho e as alternativas de adaptação para diferentes indivíduos.", competencia: "C3" },
      { codigo: "H12", descricao: "Reconhecer diferentes funções da arte, do trabalho da produção dos artistas em seus meios culturais.", competencia: "C4" },
      { codigo: "H13", descricao: "Analisar as diversas produções artísticas como meio de explicar diferentes culturas, padrões de beleza e preconceitos.", competencia: "C4" },
      { codigo: "H14", descricao: "Reconhecer o valor da diversidade artística e das inter-relações de elementos que se apresentam nas manifestações de vários grupos sociais e étnicos.", competencia: "C4" },
      { codigo: "H15", descricao: "Estabelecer relações entre o texto literário e o momento de sua produção, situando aspectos do contexto histórico, social e político.", competencia: "C5" },
      { codigo: "H16", descricao: "Relacionar informações sobre concepções artísticas e procedimentos de construção do texto literário.", competencia: "C5" },
      { codigo: "H17", descricao: "Reconhecer a presença de valores sociais e humanos atualizáveis e permanentes no patrimônio literário nacional.", competencia: "C5" },
      { codigo: "H18", descricao: "Identificar os elementos que concorrem para a progressão temática e para a organização e estruturação de textos de diferentes gêneros e tipos.", competencia: "C6" },
      { codigo: "H19", descricao: "Analisar a função da linguagem predominante nos textos em situações específicas de interlocução.", competencia: "C6" },
      { codigo: "H20", descricao: "Reconhecer a importância do patrimônio linguístico para a preservação da memória e da identidade nacional.", competencia: "C6" },
      { codigo: "H21", descricao: "Reconhecer em textos de diferentes gêneros, recursos verbais e não-verbais utilizados com a finalidade de criar e mudar comportamentos e hábitos.", competencia: "C7" },
      { codigo: "H22", descricao: "Relacionar, em diferentes textos, opiniões, temas, assuntos e recursos linguísticos.", competencia: "C7" },
      { codigo: "H23", descricao: "Inferir em um texto quais são os objetivos de seu produtor e quem é seu público alvo, pela análise dos procedimentos argumentativos utilizados.", competencia: "C7" },
      { codigo: "H24", descricao: "Reconhecer no texto estratégias argumentativas empregadas para o convencimento do público, tais como a intimidação, sedução, comoção, chantagem, entre outras.", competencia: "C7" },
      { codigo: "H25", descricao: "Identificar, em textos de diferentes gêneros, as marcas linguísticas que singularizam as variedades linguísticas sociais, regionais e de registro.", competencia: "C8" },
      { codigo: "H26", descricao: "Relacionar as variedades linguísticas a situações específicas de uso social.", competencia: "C8" },
      { codigo: "H27", descricao: "Reconhecer os usos da norma padrão da língua portuguesa nas diferentes situações de comunicação.", competencia: "C8" },
      { codigo: "H28", descricao: "Reconhecer a função e o impacto social das diferentes tecnologias da comunicação e informação.", competencia: "C9" },
      { codigo: "H29", descricao: "Identificar pela análise de suas linguagens, as tecnologias da comunicação e informação.", competencia: "C9" },
      { codigo: "H30", descricao: "Relacionar as tecnologias de comunicação e informação ao desenvolvimento das sociedades e ao conhecimento que elas produzem.", competencia: "C9" },
    ],
  },
  "Matemática e suas Tecnologias": {
    nome: "Matemática e suas Tecnologias",
    competencias: [
      { codigo: "C1", descricao: "Construir significados para os números naturais, inteiros, racionais e reais." },
      { codigo: "C2", descricao: "Utilizar o conhecimento geométrico para realizar a leitura e a representação da realidade e agir sobre ela." },
      { codigo: "C3", descricao: "Construir noções de grandezas e medidas para a compreensão da realidade e a solução de problemas do cotidiano." },
      { codigo: "C4", descricao: "Construir noções de variação de grandezas para a compreensão da realidade e a solução de problemas do cotidiano." },
      { codigo: "C5", descricao: "Modelar e resolver problemas que envolvem variáveis socioeconômicas ou técnico-científicas, usando representações algébricas." },
      { codigo: "C6", descricao: "Interpretar informações de natureza científica e social obtidas da leitura de gráficos e tabelas, realizando previsão de tendência, extrapolação, interpolação e interpretação." },
      { codigo: "C7", descricao: "Compreender o caráter aleatório e não-determinístico dos fenômenos naturais e sociais e utilizar instrumentos adequados para medidas, determinação de amostras e cálculos de probabilidade para interpretar informações de variáveis apresentadas em uma distribuição estatística." },
    ],
    habilidades: [
      { codigo: "H1", descricao: "Reconhecer, no contexto social, diferentes significados e representações dos números e operações - naturais, inteiros, racionais ou reais.", competencia: "C1" },
      { codigo: "H2", descricao: "Identificar padrões numéricos ou princípios de contagem.", competencia: "C1" },
      { codigo: "H3", descricao: "Resolver situação-problema envolvendo conhecimentos numéricos.", competencia: "C1" },
      { codigo: "H4", descricao: "Avaliar a razoabilidade de um resultado numérico na construção de argumentos sobre afirmações quantitativas.", competencia: "C1" },
      { codigo: "H5", descricao: "Avaliar propostas de intervenção na realidade utilizando conhecimentos numéricos.", competencia: "C1" },
      { codigo: "H6", descricao: "Interpretar a localização e a movimentação de pessoas/objetos no espaço tridimensional e sua representação no espaço bidimensional.", competencia: "C2" },
      { codigo: "H7", descricao: "Identificar características de figuras planas ou espaciais.", competencia: "C2" },
      { codigo: "H8", descricao: "Resolver situação-problema que envolva conhecimentos geométricos de espaço e forma.", competencia: "C2" },
      { codigo: "H9", descricao: "Utilizar conhecimentos geométricos de espaço e forma na seleção de argumentos propostos como solução de problemas do cotidiano.", competencia: "C2" },
      { codigo: "H10", descricao: "Utilizar a noção de escalas na leitura de representação de situação do cotidiano.", competencia: "C3" },
      { codigo: "H11", descricao: "Resolver situação-problema envolvendo a variação de grandezas, como as contidas em gráficos e tabelas, ou relativas a unidades de medida.", competencia: "C3" },
      { codigo: "H12", descricao: "Resolver situação-problema que envolva medidas de grandezas.", competencia: "C3" },
      { codigo: "H13", descricao: "Avaliar o resultado de uma medição na construção de um argumento consistente.", competencia: "C3" },
      { codigo: "H14", descricao: "Avaliar proposta de intervenção na realidade utilizando conhecimentos geométricos relacionados a grandezas e medidas.", competencia: "C3" },
      { codigo: "H15", descricao: "Identificar a relação de dependência entre grandezas.", competencia: "C4" },
      { codigo: "H16", descricao: "Resolver situação-problema envolvendo a variação de grandezas, direta ou inversamente proporcionais.", competencia: "C4" },
      { codigo: "H17", descricao: "Analisar informações envolvendo a variação de grandezas como recurso para a construção de argumentação.", competencia: "C4" },
      { codigo: "H18", descricao: "Avaliar propostas de intervenção na realidade envolvendo variação de grandezas.", competencia: "C4" },
      { codigo: "H19", descricao: "Identificar representações algébricas que expressem a relação entre grandezas.", competencia: "C5" },
      { codigo: "H20", descricao: "Interpretar gráfico cartesiano que represente relações entre grandezas.", competencia: "C5" },
      { codigo: "H21", descricao: "Resolver situação-problema cuja modelagem envolva conhecimentos algébricos.", competencia: "C5" },
      { codigo: "H22", descricao: "Utilizar conhecimentos algébricos/geométricos como recurso para a construção de argumentação.", competencia: "C5" },
      { codigo: "H23", descricao: "Avaliar propostas de intervenção na realidade utilizando conhecimentos algébricos.", competencia: "C5" },
      { codigo: "H24", descricao: "Utilizar informações expressas em gráficos ou tabelas para fazer inferências indutivas e dedutivas.", competencia: "C6" },
      { codigo: "H25", descricao: "Resolver problema com dados apresentados em tabelas ou gráficos.", competencia: "C6" },
      { codigo: "H26", descricao: "Analisar informações expressas em gráficos ou tabelas como recurso para a construção de argumentos.", competencia: "C6" },
      { codigo: "H27", descricao: "Calcular medidas de tendência central ou de dispersão de um conjunto de dados expressos em uma tabela de frequências de dados agrupados (não em classes) ou em gráficos.", competencia: "C7" },
      { codigo: "H28", descricao: "Resolver situação-problema que envolva conhecimentos de estatística e probabilidade.", competencia: "C7" },
      { codigo: "H29", descricao: "Utilizar conhecimentos de estatística e probabilidade como recurso para a construção de argumentação.", competencia: "C7" },
      { codigo: "H30", descricao: "Avaliar propostas de intervenção na realidade utilizando conhecimentos de estatística e probabilidade.", competencia: "C7" },
    ],
  },
  "Ciências da Natureza e suas Tecnologias": {
    nome: "Ciências da Natureza e suas Tecnologias",
    competencias: [
      { codigo: "C1", descricao: "Compreender as ciências naturais e as tecnologias a elas associadas como construções humanas, percebendo seus papéis nos processos de produção e no desenvolvimento econômico e social da humanidade." },
      { codigo: "C2", descricao: "Identificar a presença e aplicar as tecnologias associadas às ciências naturais em diferentes contextos." },
      { codigo: "C3", descricao: "Associar intervenções que resultam em degradação ou conservação ambiental a processos produtivos e sociais e a instrumentos ou ações científico-tecnológicos." },
      { codigo: "C4", descricao: "Compreender interações entre organismos e ambiente, em particular aquelas relacionadas à saúde humana, relacionando conhecimentos científicos, aspectos culturais e características individuais." },
      { codigo: "C5", descricao: "Entender métodos e procedimentos próprios das ciências naturais e aplicá-los em diferentes contextos." },
      { codigo: "C6", descricao: "Apropriar-se de conhecimentos da física para, em situações problema, interpretar, avaliar ou planejar intervenções científico-tecnológicas." },
      { codigo: "C7", descricao: "Apropriar-se de conhecimentos da química para, em situações problema, interpretar, avaliar ou planejar intervenções científico-tecnológicas." },
      { codigo: "C8", descricao: "Apropriar-se de conhecimentos da biologia para, em situações problema, interpretar, avaliar ou planejar intervenções científico-tecnológicas." },
    ],
    habilidades: [
      { codigo: "H1", descricao: "Reconhecer características ou propriedades de fenômenos ondulatórios ou oscilatórios, relacionando-os a seus usos em diferentes contextos.", competencia: "C1" },
      { codigo: "H2", descricao: "Associar a solução de problemas de comunicação, transporte, saúde ou outro, com o correspondente desenvolvimento científico e tecnológico.", competencia: "C1" },
      { codigo: "H3", descricao: "Confrontar interpretações científicas com interpretações baseadas no senso comum, ao longo do tempo ou em diferentes culturas.", competencia: "C1" },
      { codigo: "H4", descricao: "Avaliar propostas de intervenção no ambiente, considerando a qualidade da vida humana ou medidas de conservação, recuperação ou utilização sustentável da biodiversidade.", competencia: "C1" },
      { codigo: "H5", descricao: "Dimensionar circuitos ou dispositivos elétricos de uso cotidiano.", competencia: "C2" },
      { codigo: "H6", descricao: "Relacionar informações para compreender manuais de instalação ou utilização de aparelhos, ou sistemas tecnológicos de uso comum.", competencia: "C2" },
      { codigo: "H7", descricao: "Selecionar testes de controle, parâmetros ou critérios para a comparação de materiais e produtos, tendo em vista a defesa do consumidor, a saúde do trabalhador ou a qualidade de vida.", competencia: "C2" },
      { codigo: "H8", descricao: "Identificar etapas em processos de obtenção, transformação, utilização ou reciclagem de recursos naturais, energéticos ou matérias-primas, considerando processos biológicos, químicos ou físicos neles envolvidos.", competencia: "C3" },
      { codigo: "H9", descricao: "Compreender a importância dos ciclos biogeoquímicos ou do fluxo energia para a vida, ou da ação de agentes ou fenômenos que podem causar alterações nesses processos.", competencia: "C3" },
      { codigo: "H10", descricao: "Analisar perturbações ambientais, identificando fontes, transporte e(ou) destino dos poluentes ou prevendo efeitos em sistemas naturais, produtivos ou sociais.", competencia: "C3" },
      { codigo: "H11", descricao: "Reconhecer benefícios, limitações e aspectos éticos da biotecnologia, considerando estruturas e processos biológicos envolvidos em produtos biotecnológicos.", competencia: "C3" },
      { codigo: "H12", descricao: "Avaliar impactos em ambientes naturais decorrentes de atividades sociais ou econômicas, considerando interesses contraditórios.", competencia: "C3" },
      { codigo: "H13", descricao: "Reconhecer mecanismos de transmissão da vida, prevendo ou explicando a manifestação de características dos seres vivos.", competencia: "C4" },
      { codigo: "H14", descricao: "Identificar padrões em fenômenos e processos vitais dos organismos, como manutenção do equilíbrio interno, defesa, relações com o ambiente, sexualidade, entre outros.", competencia: "C4" },
      { codigo: "H15", descricao: "Interpretar modelos e experimentos para explicar fenômenos ou processos biológicos em qualquer nível de organização dos sistemas biológicos.", competencia: "C4" },
      { codigo: "H16", descricao: "Compreender o papel da evolução na produção de padrões, processos biológicos ou na organização taxonômica dos seres vivos.", competencia: "C4" },
      { codigo: "H17", descricao: "Relacionar informações apresentadas em diferentes formas de linguagem e representação usadas nas ciências físicas, químicas ou biológicas, como texto discursivo, gráficos, tabelas, relações matemáticas ou linguagem simbólica.", competencia: "C5" },
      { codigo: "H18", descricao: "Relacionar propriedades físicas, químicas ou biológicas de produtos, sistemas ou procedimentos tecnológicos às finalidades a que se destinam.", competencia: "C5" },
      { codigo: "H19", descricao: "Avaliar métodos, processos ou procedimentos das ciências naturais que contribuam para diagnosticar ou solucionar problemas de ordem social, econômica ou ambiental.", competencia: "C5" },
      { codigo: "H20", descricao: "Caracterizar causas ou efeitos dos movimentos de partículas, substâncias, objetos ou corpos celestes.", competencia: "C6" },
      { codigo: "H21", descricao: "Utilizar leis físicas e(ou) químicas para interpretar processos naturais ou tecnológicos inseridos no contexto da termodinâmica e(ou) do eletromagnetismo.", competencia: "C6" },
      { codigo: "H22", descricao: "Compreender fenômenos decorrentes da interação entre a radiação e a matéria em suas manifestações em processos naturais ou tecnológicos, ou em suas implicações biológicas, sociais, econômicas ou ambientais.", competencia: "C6" },
      { codigo: "H23", descricao: "Avaliar possibilidades de geração, uso ou transformação de energia em ambientes específicos, considerando implicações éticas, ambientais, sociais e/ou econômicas.", competencia: "C6" },
      { codigo: "H24", descricao: "Utilizar códigos e nomenclatura da química para caracterizar materiais, substâncias ou transformações químicas.", competencia: "C7" },
      { codigo: "H25", descricao: "Caracterizar materiais ou substâncias, identificando etapas, rendimentos ou implicações biológicas, sociais, econômicas ou ambientais de sua obtenção ou produção.", competencia: "C7" },
      { codigo: "H26", descricao: "Avaliar implicações sociais, ambientais e/ou econômicas na produção ou no consumo de recursos energéticos ou minerais, identificando transformações químicas ou de energia envolvidas nesses processos.", competencia: "C7" },
      { codigo: "H27", descricao: "Avaliar propostas de intervenção no meio ambiente aplicando conhecimentos químicos, observando riscos ou benefícios.", competencia: "C7" },
      { codigo: "H28", descricao: "Associar características adaptativas dos organismos com seu modo de vida ou com seus limites de distribuição em diferentes ambientes, em especial em ambientes brasileiros.", competencia: "C8" },
      { codigo: "H29", descricao: "Interpretar experimentos ou técnicas que utilizam seres vivos, analisando implicações para o ambiente, a saúde, a produção de alimentos, matérias primas ou produtos industriais.", competencia: "C8" },
      { codigo: "H30", descricao: "Avaliar propostas de alcance individual ou coletivo, identificando aquelas que visam à preservação e a implementação da saúde individual, coletiva ou do ambiente.", competencia: "C8" },
    ],
  },
  "Ciências Humanas e suas Tecnologias": {
    nome: "Ciências Humanas e suas Tecnologias",
    competencias: [
      { codigo: "C1", descricao: "Compreender os elementos culturais que constituem as identidades." },
      { codigo: "C2", descricao: "Compreender as transformações dos espaços geográficos como produto das relações socioeconômicas e culturais de poder." },
      { codigo: "C3", descricao: "Compreender a produção e o papel histórico das instituições sociais, políticas e econômicas, associando-as aos diferentes grupos, conflitos e movimentos sociais." },
      { codigo: "C4", descricao: "Entender as transformações técnicas e tecnológicas e seu impacto nos processos de produção, no desenvolvimento do conhecimento e na vida social." },
      { codigo: "C5", descricao: "Utilizar os conhecimentos históricos para compreender e valorizar os fundamentos da cidadania e da democracia, favorecendo uma atuação consciente do indivíduo na sociedade." },
      { codigo: "C6", descricao: "Compreender a sociedade e a natureza, reconhecendo suas interações no espaço em diferentes contextos históricos e geográficos." },
    ],
    habilidades: [
      { codigo: "H1", descricao: "Interpretar historicamente e/ou geograficamente fontes documentais acerca de aspectos da cultura.", competencia: "C1" },
      { codigo: "H2", descricao: "Analisar a produção da memória pelas sociedades humanas.", competencia: "C1" },
      { codigo: "H3", descricao: "Associar as manifestações culturais do presente aos seus processos históricos.", competencia: "C1" },
      { codigo: "H4", descricao: "Comparar pontos de vista expressos em diferentes fontes sobre determinado aspecto da cultura.", competencia: "C1" },
      { codigo: "H5", descricao: "Identificar as manifestações ou representações da diversidade do patrimônio cultural e artístico em diferentes sociedades.", competencia: "C1" },
      { codigo: "H6", descricao: "Interpretar diferentes representações gráficas e cartográficas dos espaços geográficos.", competencia: "C2" },
      { codigo: "H7", descricao: "Identificar os significados histórico-geográficos das relações de poder entre as nações.", competencia: "C2" },
      { codigo: "H8", descricao: "Analisar a ação dos estados nacionais no que se refere à dinâmica dos fluxos populacionais e no enfrentamento de problemas de ordem econômico-social.", competencia: "C2" },
      { codigo: "H9", descricao: "Comparar o significado histórico-geográfico das organizações políticas e socioeconômicas em escala local, regional ou mundial.", competencia: "C2" },
      { codigo: "H10", descricao: "Reconhecer a dinâmica da organização dos movimentos sociais e a importância da participação da coletividade na transformação da realidade histórico-geográfica.", competencia: "C2" },
      { codigo: "H11", descricao: "Identificar registros de práticas de grupos sociais no tempo e no espaço.", competencia: "C3" },
      { codigo: "H12", descricao: "Analisar o papel da justiça como instituição na organização das sociedades.", competencia: "C3" },
      { codigo: "H13", descricao: "Analisar a atuação dos movimentos sociais que contribuíram para mudanças ou rupturas em processos de disputa pelo poder.", competencia: "C3" },
      { codigo: "H14", descricao: "Comparar diferentes pontos de vista, presentes em textos analíticos e interpretativos, sobre situação ou fatos de natureza histórico-geográfica acerca das instituições sociais, políticas e econômicas.", competencia: "C3" },
      { codigo: "H15", descricao: "Avaliar criticamente conflitos culturais, sociais, políticos, econômicos ou ambientais ao longo da história.", competencia: "C3" },
      { codigo: "H16", descricao: "Identificar registros sobre o papel das técnicas e tecnologias na organização do trabalho e/ou da vida social.", competencia: "C4" },
      { codigo: "H17", descricao: "Analisar fatores que explicam o impacto das novas tecnologias no processo de territorialização da produção.", competencia: "C4" },
      { codigo: "H18", descricao: "Analisar diferentes processos de produção ou circulação de riquezas e suas implicações sócio-espaciais.", competencia: "C4" },
      { codigo: "H19", descricao: "Reconhecer as transformações técnicas e tecnológicas que determinam as várias formas de uso e apropriação dos espaços rural e urbano.", competencia: "C4" },
      { codigo: "H20", descricao: "Selecionar argumentos favoráveis ou contrários às modificações impostas pelas novas tecnologias à vida social e ao mundo do trabalho.", competencia: "C4" },
      { codigo: "H21", descricao: "Identificar o papel dos meios de comunicação na construção da vida social.", competencia: "C5" },
      { codigo: "H22", descricao: "Analisar as lutas sociais e conquistas obtidas no que se refere às mudanças nas legislações ou nas políticas públicas.", competencia: "C5" },
      { codigo: "H23", descricao: "Analisar a importância dos valores éticos na estruturação política das sociedades.", competencia: "C5" },
      { codigo: "H24", descricao: "Relacionar cidadania e democracia na organização das sociedades.", competencia: "C5" },
      { codigo: "H25", descricao: "Identificar estratégias que promovam formas de inclusão social.", competencia: "C5" },
      { codigo: "H26", descricao: "Relacionar as variações climáticas e hidrológicas com sua produção no espaço geográfico.", competencia: "C6" },
      { codigo: "H27", descricao: "Analisar de maneira crítica as interações da sociedade com o meio físico, levando em consideração aspectos históricos e(ou) geográficos.", competencia: "C6" },
      { codigo: "H28", descricao: "Relacionar o uso das tecnologias com os impactos sócio-ambientais em diferentes contextos histórico-geográficos.", competencia: "C6" },
      { codigo: "H29", descricao: "Reconhecer a função dos recursos naturais na produção do espaço geográfico, relacionando-os com as mudanças provocadas pelas ações humanas.", competencia: "C6" },
      { codigo: "H30", descricao: "Avaliar as relações entre preservação e degradação da vida no planeta nas diferentes escalas.", competencia: "C6" },
    ],
  },
};

export function getCompetenciasPorArea(area: AreaConhecimento): CompetenciaEnem[] {
  return ENEM_MATRIX[area]?.competencias ?? [];
}

export function getHabilidadesPorArea(area: AreaConhecimento): HabilidadeEnem[] {
  return ENEM_MATRIX[area]?.habilidades ?? [];
}

export function getHabilidadesPorCompetencia(
  area: AreaConhecimento,
  competenciaCodigo: string,
): HabilidadeEnem[] {
  return (ENEM_MATRIX[area]?.habilidades ?? []).filter(
    (h) => h.competencia === competenciaCodigo,
  );
}

export function findCompetencia(
  area: AreaConhecimento,
  codigo: string,
): CompetenciaEnem | undefined {
  return ENEM_MATRIX[area]?.competencias.find((c) => c.codigo === codigo);
}

export function findHabilidade(
  area: AreaConhecimento,
  codigo: string,
): HabilidadeEnem | undefined {
  return ENEM_MATRIX[area]?.habilidades.find((h) => h.codigo === codigo);
}
