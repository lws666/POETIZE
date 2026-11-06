<template>
  <div>
    <el-tag effect="dark" class="my-tag">
      <svg viewBox="0 0 1024 1024" width="20" height="20" style="vertical-align: -3px;">
        <path d="M512 896 128 640l96-64 288 192 288-192 96 64z" fill="#11AA66"></path>
        <path d="M512 768 128 512l96-64 288 192 288-192 96 64z" fill="#22BB77"></path>
        <path d="M512 640 128 384l384-256 384 256z" fill="#FFAA44"></path>
      </svg>
      友链管理
    </el-tag>

    <div style="margin-bottom: 16px">
      <el-radio-group v-model="status" size="small" @change="getFriends">
        <el-radio-button :label="0">待审核 {{ counts[0] || 0 }}</el-radio-button>
        <el-radio-button :label="1">已通过 {{ counts[1] || 0 }}</el-radio-button>
        <el-radio-button :label="2">已拒绝 {{ counts[2] || 0 }}</el-radio-button>
      </el-radio-group>
    </div>

    <el-table :data="friends" border class="table" header-cell-class-name="table-header">
      <el-table-column prop="id" label="ID" width="60" align="center"></el-table-column>

      <el-table-column label="封面" width="90" align="center">
        <template slot-scope="scope">
          <el-avatar :size="40" shape="square" :src="scope.row.cover"></el-avatar>
        </template>
      </el-table-column>

      <el-table-column prop="title" label="名称" width="140" align="center"></el-table-column>
      <el-table-column prop="introduction" label="简介" align="center" show-overflow-tooltip></el-table-column>

      <el-table-column label="网址" width="180" align="center">
        <template slot-scope="scope">
          <a :href="scope.row.url" target="_blank" rel="noopener"
             style="color: var(--themeBackground); word-break: break-all">
            {{ scope.row.url }}
          </a>
        </template>
      </el-table-column>

      <el-table-column prop="createTime" label="提交时间" width="170" align="center"></el-table-column>

      <el-table-column label="操作" width="220" align="center">
        <template slot-scope="scope">
          <el-button v-if="scope.row.status !== 1" type="text" icon="el-icon-check"
                     style="color: #11AA66" @click="audit(scope.row, 1)">
            通过
          </el-button>
          <el-button v-if="scope.row.status !== 2" type="text" icon="el-icon-close"
                     style="color: #FF9900" @click="audit(scope.row, 2)">
            拒绝
          </el-button>
          <el-button type="text" icon="el-icon-delete"
                     style="color: var(--orangeRed)" @click="handleDelete(scope.row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="friends.length === 0" style="text-align: center; padding: 40px; color: #999">
      没有{{ statusText }}的友链
    </div>
  </div>
</template>

<script>
export default {
  name: 'friendList',
  data() {
    return {
      status: 0,
      friends: [],
      counts: {}
    }
  },
  computed: {
    statusText() {
      return ['待审核', '已通过', '已拒绝'][this.status] || ''
    }
  },
  created() {
    this.getFriends()
    this.getCounts()
  },
  methods: {
    getFriends() {
      this.$http.get(this.$constant.baseURL + '/webInfo/listAdminFriend?status=' + this.status, {}, true)
        .then(res => {
          this.friends = Array.isArray(res.data) ? res.data : []
        })
        .catch(err => {
          this.$message({ message: err.message, type: 'error' })
        })
    },

    /** 分别拉三种状态的数量，用于 tab 上的角标 */
    getCounts() {
      const tasks = [0, 1, 2].map(s =>
        this.$http.get(this.$constant.baseURL + '/webInfo/listAdminFriend?status=' + s, {}, true)
          .then(res => (Array.isArray(res.data) ? res.data.length : 0))
          .catch(() => 0)
      )
      Promise.all(tasks).then(arr => {
        this.counts = { 0: arr[0], 1: arr[1], 2: arr[2] }
      })
    },

    audit(row, status) {
      const label = status === 1 ? '通过' : '拒绝'
      this.$confirm(`确定${label}「${row.title}」的友链申请？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.$http.get(this.$constant.baseURL + `/webInfo/auditFriend?id=${row.id}&status=${status}`, {}, true)
          .then(() => {
            this.$message({ message: `已${label}`, type: 'success' })
            this.getFriends()
            this.getCounts()
          })
          .catch(err => {
            this.$message({ message: err.message, type: 'error' })
          })
      }).catch(() => {})
    },

    handleDelete(row) {
      this.$confirm(`确定删除「${row.title}」？删除后不可恢复。`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.$http.get(this.$constant.baseURL + '/webInfo/deleteFriend?id=' + row.id, {}, true)
          .then(() => {
            this.$message({ message: '删除成功', type: 'success' })
            this.getFriends()
            this.getCounts()
          })
          .catch(err => {
            this.$message({ message: err.message, type: 'error' })
          })
      }).catch(() => {})
    }
  }
}
</script>

<style scoped>
.my-tag {
  margin-bottom: 20px;
  font-size: 14px;
  padding: 8px 14px;
  border-radius: 6px;
}
.table {
  width: 100%;
}
</style>
