import { escapeHtml, icon } from './icons.js';

const STATUS_META = Object.freeze({
  notStarted: { label: '未开始', className: 'not-started' },
  viewed: { label: '已看过', className: 'viewed' },
  practiced: { label: '已练习', className: 'practiced' },
  reviewDue: { label: '待复习', className: 'review-due' },
  mastered: { label: '已掌握', className: 'mastered' },
});

const PHASE_LABELS = Object.freeze({
  learn: '勘察',
  build: '施工',
  review: '验收',
});

function selected(value, expected) {
  return String(value) === String(expected) ? ' selected' : '';
}

function formatDate(timestamp) {
  if (!Number.isInteger(timestamp)) return '—';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date);
}

function textList(values) {
  if (!values?.length) return '<span class="empty-value">—</span>';
  return values.map((value) => `<span>${escapeHtml(value)}</span>`).join('');
}

function focusClass(filters, subject) {
  return filters.subject === subject ? ' class="is-focused"' : '';
}

function statusLegend() {
  return Object.entries(STATUS_META).map(([status, meta]) => `
    <span class="status-legend-item"><i class="status-dot is-${meta.className}" aria-hidden="true"></i>${meta.label}</span>`).join('');
}

function filterControls(model) {
  const filters = model.filters ?? {};
  const regionOptions = (model.regions ?? []).map((region) => (
    `<option value="${escapeHtml(region.id)}"${selected(filters.regionId, region.id)}>${escapeHtml(region.title)}</option>`
  )).join('');
  return `
    <div class="course-filters" aria-label="课程筛选">
      <label><span>阶段</span><select data-course-filter="tier">
        <option value="all"${selected(filters.tier, 'all')}>全部</option>
        <option value="1"${selected(filters.tier, 1)}>阶段 1</option>
        <option value="2"${selected(filters.tier, 2)}>阶段 2</option>
        <option value="3"${selected(filters.tier, 3)}>阶段 3</option>
      </select></label>
      <label><span>科目</span><select data-course-filter="subject">
        <option value="all"${selected(filters.subject, 'all')}>全部</option>
        <option value="chinese"${selected(filters.subject, 'chinese')}>汉字</option>
        <option value="english"${selected(filters.subject, 'english')}>英语</option>
        <option value="math"${selected(filters.subject, 'math')}>数学</option>
      </select></label>
      <label><span>区域</span><select data-course-filter="regionId">
        <option value="all"${selected(filters.regionId, 'all')}>全部</option>
        ${regionOptions}
      </select></label>
      <label><span>状态</span><select data-course-filter="status">
        <option value="all"${selected(filters.status, 'all')}>全部</option>
        ${Object.entries(STATUS_META).map(([status, meta]) => (
          `<option value="${status}"${selected(filters.status, status)}>${meta.label}</option>`
        )).join('')}
      </select></label>
    </div>`;
}

function summaryView(summary) {
  const status = summary.statuses ?? {};
  const subjects = summary.subjects ?? {};
  return `
    <section class="course-summary" aria-label="学习摘要">
      <div><strong>${summary.total ?? 0}</strong><span>课程总数</span></div>
      <div><strong>${status.notStarted ?? 0}</strong><span>未开始</span></div>
      <div><strong>${status.viewed ?? 0}</strong><span>已看过</span></div>
      <div><strong>${status.practiced ?? 0}</strong><span>已练习</span></div>
      <div><strong>${status.reviewDue ?? 0}</strong><span>待复习</span></div>
      <div><strong>${status.mastered ?? 0}</strong><span>已掌握</span></div>
      <p>内容覆盖：汉字 <strong>${subjects.chinese ?? 0}</strong> · 英语 <strong>${subjects.english ?? 0}</strong> · 数学 <strong>${subjects.math ?? 0}</strong></p>
    </section>`;
}

function rowView(row, filters) {
  const meta = STATUS_META[row.status] ?? STATUS_META.notStarted;
  return `
    <tr>
      <th scope="row"><strong>${escapeHtml(String(row.ordinal))}</strong><span>${escapeHtml(row.id)}</span></th>
      <td class="course-title-cell"><strong>${escapeHtml(row.projectTitle || row.title)}</strong><span>${escapeHtml(PHASE_LABELS[row.phase] ?? row.phase)}</span></td>
      <td>阶段 ${escapeHtml(String(row.tier))}</td>
      <td>${escapeHtml(row.regionTitle)}</td>
      <td data-course-subject="chinese"${focusClass(filters, 'chinese')}>${textList(row.chinese)}</td>
      <td data-course-subject="english"${focusClass(filters, 'english')}>${textList(row.englishWords)}</td>
      <td data-course-subject="english"${focusClass(filters, 'english')}>${textList(row.englishPatterns)}</td>
      <td data-course-subject="math"${focusClass(filters, 'math')}>${escapeHtml(row.mathTarget || '—')}</td>
      <td>${escapeHtml(row.estimatedMinutes)} 分钟</td>
      <td>${escapeHtml(formatDate(row.viewedAt))}</td>
      <td>${escapeHtml(String(row.completedCount))}</td>
      <td>${escapeHtml(formatDate(row.lastCompletedAt))}</td>
      <td>${escapeHtml(String(row.hintCount))}</td>
      <td><span class="course-status is-${meta.className}"><i aria-hidden="true"></i>${meta.label}</span></td>
    </tr>`;
}

export function renderCourseTable(model = {}) {
  const rows = model.rows ?? [];
  const filters = model.filters ?? { tier: 'all', subject: 'all', regionId: 'all', status: 'all' };
  return `
    ${model.storageAvailable === false ? '<p class="parent-storage-warning" role="alert">本次记录不会保存：浏览器存储当前不可用。</p>' : ''}
    ${summaryView(model.summary ?? {})}
    <div class="course-toolbar">
      ${filterControls({ ...model, filters })}
      <button class="secondary-button export-progress" type="button" data-action="export-progress">${icon('download')}<span>下载 JSON</span></button>
    </div>
    <div class="status-legend" aria-label="课程状态图例">${statusLegend()}</div>
    <p class="course-result-count" aria-live="polite">显示 <strong>${rows.length}</strong> 节课程</p>
    <div class="course-table-scroll" tabindex="0">
      <table class="course-table" data-focus-subject="${escapeHtml(filters.subject ?? 'all')}">
        <thead><tr>
          <th scope="col">编号</th><th scope="col">项目·课次</th><th scope="col">阶段</th><th scope="col">区域</th>
          <th scope="col" data-course-subject="chinese"${focusClass(filters, 'chinese')}>汉字</th>
          <th scope="col" data-course-subject="english"${focusClass(filters, 'english')}>英语词汇</th>
          <th scope="col" data-course-subject="english"${focusClass(filters, 'english')}>句型</th>
          <th scope="col" data-course-subject="math"${focusClass(filters, 'math')}>数学目标</th>
          <th scope="col">预计时长</th><th scope="col">首次查看</th><th scope="col">完成次数</th>
          <th scope="col">最近学习</th><th scope="col">提示次数</th><th scope="col">状态</th>
        </tr></thead>
        <tbody>${rows.length > 0
          ? rows.map((row) => rowView(row, filters)).join('')
          : '<tr><td class="course-empty" colspan="14">没有符合当前筛选条件的课程。</td></tr>'}</tbody>
      </table>
    </div>`;
}
