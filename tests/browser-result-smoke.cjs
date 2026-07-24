const assert=require('node:assert/strict'); const {chromium}=require('playwright');
const base=process.env.DIW_BROWSER_URL||'http://127.0.0.1:4318';
async function json(path,options={}){const r=await fetch(base+path,{headers:{'content-type':'application/json'},...options});const d=await r.json();if(!r.ok)throw new Error(JSON.stringify(d));return d;}

(async()=>{let browser;try{
  const run=await json('/api/requests',{method:'POST',body:JSON.stringify({query:'結果描画を検証するテスト専用分析',decision_types:['strategy','investment','business'],horizon:'3-5 years'})});
  const e=['e1']; const result={
    schema_version:'1.0',metadata:{run_id:run.id,title:'結果描画テスト',generated_at:new Date().toISOString(),as_of:'2026-07-25',coverage:{regions:['global'],sectors:['cross_sector'],horizon:'3-5 years'},decision:['strategy','investment','business']},
    executive:{one_line:'証拠から因果をたどり、小さく検証してから拡大する。',decision:'次の90日で一次検証を行う。',confidence:.68,why_now:['制度とコストの変曲点'],watchouts:['需要の前倒し'],decision_spine:[{step:'構造変化',claim:'供給制約が価値配分を変える',evidence_ids:e},{step:'判断',claim:'ボトルネック工程から検証する',evidence_ids:e}]},
    megatrends:[{id:'t1',name:'供給網の再構成',stage:'scaling',horizon:'3-5 years',velocity:.7,impact:.82,confidence:.68,description:'集中供給から冗長性へ移る。',drivers:['policy'],implications:['capacity'],evidence_ids:e}],
    knowledge_graph:{nodes:[{id:'n1',label:'規制変更',type:'policy',confidence:.8,evidence_ids:e},{id:'n2',label:'供給制約',type:'risk',confidence:.7,evidence_ids:e},{id:'n3',label:'新規工程',type:'technology',confidence:.65,evidence_ids:e}],edges:[{source:'n1',target:'n2',type:'amplifies',weight:.7,polarity:'negative',evidence_ids:e},{source:'n2',target:'n3',type:'accelerates',weight:.6,polarity:'positive',evidence_ids:e}]},
    whitespaces:[{id:'w1',name:'検証インフラ',customer:'製造責任者',pain:'導入前に性能を比較できない',unmet_reason:'標準化不足',market_timing:'now',score:{market_attractiveness:78,feasibility:66,evidence_strength:70},opportunity:'比較・監査サービス',risks:['standard shift'],next_test:'5社インタビュー',evidence_ids:e}],
    profit_pools:[{id:'p1',name:'検証・認証',value_chain_stage:'qualification',revenue_pool:70,margin_direction:'up',growth_direction:'up',capture_mechanism:'switching cost',barriers:['data history'],winners:['specialists'],losers:['commodity suppliers'],evidence_ids:e}],
    investment_routes:[{id:'i1',name:'検証装置ルート',theme:'供給網再構成',transmission:'認証需要増',beneficiaries:['装置企業'],catalysts:['規制期限'],expectations_gap:'付帯収益が未評価',valuation:'同業比較が必要',crowding:'中程度',downside:'設備投資延期',decision:'監視',confidence:.6,evidence_ids:e}],
    business_routes:[{id:'b1',name:'検証SaaS',structural_change:'監査強化',pain:'証跡作成が手作業',buyer:'品質責任者',budget:'compliance',solution:'証拠台帳',pricing:'annual subscription',unit_economics:'pilotで検証',channel:'industry partners',validation:'3社有償pilot',kill_criteria:'支払意思なし',evidence_ids:e}],
    scenarios:[{id:'s1',name:'加速',probability:.55,narrative:'規制と投資が同時に進む。',axes:['policy','cost'],indicators:['認証件数'],implications:['早期参入'],evidence_ids:e},{id:'s2',name:'停滞',probability:.45,narrative:'コスト高で延期される。',axes:['policy','cost'],indicators:['設備延期'],implications:['option維持'],evidence_ids:e}],
    forecasts:[{id:'f1',question:'2028年までに認証件数が前年比20%増えるか',resolution_date:'2028-12-31',probability:.62,base_rate:'類似制度移行の過半',reasoning:'期限と能力増設を合成',up_factors:['早期規制'],down_factors:['延期'],resolution_criteria:'公式年間件数が前年比20%以上',evidence_ids:e}],
    evidence:[{id:'e1',title:'Test primary source',url:'https://example.com/primary',publisher:'Official test authority',published_at:'2026-07-01',accessed_at:'2026-07-25',source_tier:'primary',statement_type:'fact',supports:['供給制約の存在'],limitations:'UI検証用で実分析には使用しない',counterevidence_ids:[]}],
    counterarguments:[{claim:'需要が一時的',evidence_ids:e}],methodology:[{id:'reference_class',note:'base rate first'}],limitations:['UI検証用の合成fixture']
  };
  await json(`/api/runs/${run.id}/result`,{method:'POST',body:JSON.stringify(result)});
  browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'}); const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(`${base}?run=${run.id}`,{waitUntil:'networkidle'}); await page.getByText('証拠から因果をたどり').waitFor();
  for(const label of ['変革マップ','メガトレンド','ホワイトスペース','利益プール','投資ルート','事業ルート','シナリオ','証拠台帳','予測台帳','データ接続','方法論']){await page.locator('#view-tabs').getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(80);assert.ok((await page.locator('#view-content').innerText()).trim().length>20,label);}
  await page.locator('#view-tabs').getByRole('button',{name:'結論',exact:true}).click(); await page.screenshot({path:'browser-result-smoke.png',fullPage:true}); assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,views:12,screenshot:'browser-result-smoke.png',run_id:run.id},null,2));
}finally{if(browser)await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
