import { useState, useEffect } from 'react';
// Imports dos componentes na mesma pasta
import LancamentoForm from './LancamentoForm';
import ConciliacaoBancaria from './ConciliacaoBancaria';
import RelatorioMensal from './RelatorioMensal';
import RelatorioDetalhado from './RelatorioDetalhado';
import Login from './Login'; 

// Imports de utils e lib (subindo um nível)
import { gerarPDFComTemplate, baixarPDF } from '../utils/pdfGenerator';
import { supabase } from '../lib/supabaseClient';
import '../App.css';

export default function App() {
  // ==========================================================
  // PASSO 1: TODOS OS useState DEVEM VIR PRIMEIRO (SEM EXCEÇÃO)
  // ==========================================================
  const [session, setSession] = useState(null); // Novo: controle de login
  const [abaAtiva, setAbaAtiva] = useState('lancamentos');
  const [cidadeSelecionada, setCidadeSelecionada] = useState('');
  const [cidades, setCidades] = useState([]);
  const [mostrarListaCidades, setMostrarListaCidades] = useState(false);

  // ==========================================================
  // PASSO 2: TODOS OS useEffect DEVEM VIR DEPOIS DOS useState
  // ==========================================================
  
  // Efeito 1: Ouvir mudanças de autenticação do Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Efeito 2: Carregar cidades do banco de dados
  useEffect(() => {
    async function carregarCidades() {
      const { data } = await supabase.from('cidades').select('*').order('nome');
      setCidades(data || []);
    }
    carregarCidades();
  }, []);

  // ==========================================================
  // PASSO 3: FUNÇÕES NORMAIS E VARIÁVEIS
  // ==========================================================
  async function handleGerarPDF(tipoDoc) {
    if (!cidadeSelecionada) {
      alert('Selecione uma cidade primeiro!');
      return;
    }
    
    try {
      const { data: lancamentos, error } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('cidade_id', cidadeSelecionada)
        .order('data', { ascending: false })
        .limit(5);

      if (error) throw error;

      const ultimoLancamento = lancamentos && lancamentos.length > 0 ? lancamentos[0] : null;

      const dadosReais = {
        data: ultimoLancamento?.data || new Date(),
        valor: ultimoLancamento?.valor || 0,
        descricao: ultimoLancamento?.descricao || 'Sem lançamentos recentes',
        igreja: ultimoLancamento?.igreja_id ? 'Ver detalhes' : 'Geral',
        local: 'Sede',
        km: 0,
        saldoInicial: 0,
        entradas: 0,
        saidas: 0,
        saldoFinal: 0
      };
      
      const doc = await gerarPDFComTemplate(tipoDoc, dadosReais, cidadeSelecionada);
      baixarPDF(doc, `${tipoDoc}-${new Date().toISOString().split('T')[0]}`);
      
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar PDF: ' + err.message);
    }
  }

  const cidadeNome = cidades.find(c => c.id === cidadeSelecionada)?.nome || 'Selecione...';

  // ==========================================================
  // PASSO 4: A PORTA DE SEGURANÇA (SÓ AGORA PODEMOS DAR RETURN ANTECIPADO)
  // ==========================================================
  if (!session) {
    return <Login />;
  }

  // ==========================================================
  // PASSO 5: O RETORNO PRINCIPAL DO SISTEMA (QUANDO LOGADO)
  // ==========================================================
  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>📊 Sistema de Caixa - Mesa da Piedade</h1>
        <button 
          onClick={() => supabase.auth.signOut()}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#dc2626', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: 'pointer', 
            fontWeight: 'bold',
            fontSize: '0.9rem'
          }}
        >
          Sair do Sistema
        </button>
      </div>
      
      <div className="card filtro-cidade relative z-50 inline-block">
        <label className="text-sm font-bold text-gray-700 mr-2">Cidade Base:</label>
        
        <button 
          onClick={() => setMostrarListaCidades(!mostrarListaCidades)}
          className="bg-white border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-blue-400 focus:outline-none flex items-center gap-2 min-w-[160px] justify-between"
        >
          <span className="truncate">{cidadeNome}</span>
          <span className="text-xs shrink-0">▼</span>
        </button>
        
        {mostrarListaCidades && (
          <div className="absolute top-full left-0 w-full bg-white border border-gray-200 shadow-xl rounded mt-1 max-h-60 overflow-y-auto z-50">
            {cidades.map(c => (
              <div 
                key={c.id} 
                onClick={() => { 
                  setCidadeSelecionada(c.id); 
                  setMostrarListaCidades(false); 
                }}
                className={`px-4 py-2 cursor-pointer hover:bg-blue-50 text-sm ${cidadeSelecionada === c.id ? 'bg-blue-100 font-bold text-blue-700' : ''}`}
              >
                {c.nome}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="abas">
        <button className={abaAtiva === 'lancamentos' ? 'ativa' : ''} onClick={() => setAbaAtiva('lancamentos')}> Lançamentos</button>
        <button className={abaAtiva === 'conciliacao' ? 'ativa' : ''} onClick={() => setAbaAtiva('conciliacao')}>🏦 Conciliação Bancária</button>
        <button className={abaAtiva === 'documentos' ? 'ativa' : ''} onClick={() => setAbaAtiva('documentos')}> Documentos Oficiais</button>
        <button className={abaAtiva === 'relatorio' ? 'ativa' : ''} onClick={() => setAbaAtiva('relatorio')}>📈 Relatório Mensal</button>
        <button className={abaAtiva === 'detalhado' ? 'ativa' : ''} onClick={() => setAbaAtiva('detalhado')}>📋 Relatório Detalhado</button>
      </div>

      <div className="conteudo-aba">
        {abaAtiva === 'lancamentos' && <LancamentoForm onSucesso={() => console.log('Lançamento salvo!')} />}
        {abaAtiva === 'conciliacao' && <ConciliacaoBancaria />}
        {abaAtiva === 'relatorio' && <RelatorioMensal cidadeId={cidadeSelecionada} />}
        {abaAtiva === 'detalhado' && <RelatorioDetalhado cidadeId={cidadeSelecionada} />}
        
        {abaAtiva === 'documentos' && (
          <div className="card documentos-grid">
            <h2>Gerar Documentos Oficiais</h2>
            <p className="aviso">Selecione a cidade acima antes de gerar</p>
            <div className="botoes-documentos">
              <button onClick={() => handleGerarPDF('irmas')}>Exclusivo Irmãs & Colaboradores</button>
              <button onClick={() => handleGerarPDF('verificacaoCaixa')}>Termo de Verificação de Caixa</button>
              <button onClick={() => handleGerarPDF('conciliacao')}>Conciliação Bancária</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}