// 加载环境变量（必须写在第一行）
require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// ================= 配置区域（请填入你自己的 Supabase 信息）=================
// 从环境变量读取，不会泄露到GitHub
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
// ===========================================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 1. 生成购买后的唯一答题token
app.post('/api/generate-token', async (req, res) => {
  const token = uuidv4();
  
  const { error } = await supabase
    .from('tokens')
    .insert([{ token, status: 'unused' }]);

  if (error) return res.json({ code: 500, msg: '数据库错误', data: null });

  res.json({
    code: 200,
    msg: '购买成功',
    data: {
      token,
      // 这里的链接后面要换成你 Vercel 的域名
      accessUrl: `https://gaokao-quiz-zhanghaha1004s-projects.vercel.app/index.html?token=${token}`
    }
  });
});

// 2. 验证token状态
app.get('/api/verify-token', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.json({ code: 400, msg: '缺少凭证', data: { valid: false } });

  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !data) return res.json({ code: 403, msg: '无效凭证', data: { valid: false } });

  res.json({
    code: 200,
    msg: '验证成功',
    data: { valid: true, status: data.status, report: data.report }
  });
});

// 3. 提交测评结果
app.post('/api/submit-quiz', async (req, res) => {
  const { token, answers, score, report } = req.body;

  const { data: tokenData, error: fetchError } = await supabase
    .from('tokens')
    .select('*')
    .eq('token', token)
    .single();

  if (fetchError || !tokenData) return res.json({ code: 403, msg: '无效token' });
  if (tokenData.status === 'answered') return res.json({ code: 403, msg: '已完成测评' });

  const { error } = await supabase
    .from('tokens')
    .update({ status: 'answered', report, score })
    .eq('token', token);

  if (error) return res.json({ code: 500, msg: '保存失败' });

  res.json({
    code: 200,
    msg: '提交成功',
    data: {
      reportUrl: `https://你的项目名.vercel.app/report.html?token=${token}`
    }
  });
});

// 4. 获取报告
app.get('/api/get-report', async (req, res) => {
  const { token } = req.query;
  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !data || !data.report) return res.json({ code: 403, msg: '暂无报告' });
  
  res.json({ code: 200, msg: '获取成功', data: data.report });
});

app.listen(PORT, () => {
  console.log(`服务已启动: http://localhost:${PORT}`);
});