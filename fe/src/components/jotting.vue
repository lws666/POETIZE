<template>
  <div>
    <div class="my-animation-slide-top myCenter" style="position: relative;height: 45vh">
      <!-- 背景图片 -->
      <el-image class="my-el-image jotting-image"
                style="position: absolute"
                v-once
                lazy
                :src="$store.state.webInfo.randomCover[Math.floor(Math.random() * $store.state.webInfo.randomCover.length)]"
                fit="cover">
        <div slot="error" class="image-slot"></div>
      </el-image>
      <el-image style="position: absolute;height: 20vh;left: 10px;top: 0"
                v-once
                lazy
                :src="$store.state.sysConfig['webStaticResourcePrefix'] + 'assets/cloud.png'"
                fit="cover">
        <div slot="error"></div>
      </el-image>
      <div class="jotting-title">
        <div style="font-size: 30px">🏖️随笔随心</div>
        <div style="font-size: 20px">随心所悦，阅读改变生活</div>
      </div>
      <div class="jotting-info-news"
           @click="weiYanDialogVisible = true"
           v-if="!$common.isEmpty($store.state.currentUser) && $store.state.currentUser.id === $constant.userId">
        <svg width="30" height="30" viewBox="0 0 1024 1024">
          <path d="M0 0h1024v1024H0V0z" fill="#202425" opacity=".01"></path>
          <path
            d="M989.866667 512c0 263.918933-213.947733 477.866667-477.866667 477.866667S34.133333 775.918933 34.133333 512 248.081067 34.133333 512 34.133333s477.866667 213.947733 477.866667 477.866667z"
            fill="#FF7744"></path>
          <path
            d="M512 221.866667A51.2 51.2 0 0 1 563.2 273.066667v187.733333H750.933333a51.2 51.2 0 0 1 0 102.4h-187.733333V750.933333a51.2 51.2 0 0 1-102.4 0v-187.733333H273.066667a51.2 51.2 0 0 1 0-102.4h187.733333V273.066667A51.2 51.2 0 0 1 512 221.866667z"
            fill="#FFFFFF"></path>
        </svg>
      </div>
    </div>

    <div class="jotting-container">
      <div class="jotting-content">
        <div>
          <div class="jotting-li"
               v-for="(treeHole, index) in treeHoleList"
               :key="index">
            <div style="display: flex">
              <div style="margin: 10px 15px 10px 10px">
                <el-avatar shape="square" :size="36"
                           :src="treeHole.avatar"></el-avatar>
              </div>
              <div style="flex: 1">
                <div style="margin: 10px 0 15px">
                  <span class="jotting-username">{{ treeHole.username }}</span>
                  <span class="jotting-lv">{{ treeHole.createTimeLv }}</span>
                </div>
                <div style="margin-right: 20px;letter-spacing: 1px;line-height: 1.4">
                  <span v-html="treeHole.content"></span>
                </div>
                <div style="display: flex;justify-content: space-between;margin:  25px 0 10px">
                  <div style="display: flex">
                    <div class="jotting-time">
                      {{ $common.getDateDiff(treeHole.createTime) }}
                    </div>
                    <div @click="deleteTreeHole(treeHole.id)"
                         class="jotting-delete"
                         v-if="!$common.isEmpty($store.state.currentUser) && $store.state.currentUser.id === treeHole.userId">
                      <svg viewBox="0 0 1024 1024" width="16" height="16" style="vertical-align: -6px;">
                        <path
                          d="M921.1392 155.392h-270.592v-48.2816c0-22.7328-18.432-41.1648-41.1648-41.1648H426.3424a41.1648 41.1648 0 0 0-41.1648 41.1648v48.2816H110.6432c-14.1312 0-25.6 11.4688-25.6 25.6s11.4688 25.6 25.6 25.6h810.496c14.1312 0 25.6-11.4688 25.6-25.6s-11.4688-25.6-25.6-25.6zM170.8032 260.0448v592.8448c0 50.8928 41.2672 92.16 92.16 92.16h500.6848c50.8928 0 92.16-41.2672 92.16-92.16V260.0448H170.8032z m249.1392 462.7968c0 14.1312-11.4688 25.6-25.6 25.6s-25.6-11.4688-25.6-25.6V443.0848c0-14.1312 11.4688-25.6 25.6-25.6s25.6 11.4688 25.6 25.6v279.7568z m243.1488 0c0 14.1312-11.4688 25.6-25.6 25.6s-25.6-11.4688-25.6-25.6V443.0848c0-14.1312 11.4688-25.6 25.6-25.6s25.6 11.4688 25.6 25.6v279.7568z"
                          fill="#FF623E"></path>
                      </svg>
                    </div>
                  </div>
                  <div @click="openComment(treeHole)"
                       style="cursor: pointer;margin-right: 30px;padding: 3px 9px;background: var(--azure);border-radius: 3px">
                    <span style="color: rgb(4, 176, 15)">{{ treeHole.commentCount }} </span>
                    <span>
                      <svg viewBox="0 0 1024 1024" width="20" height="20" style="vertical-align: -4px;">
                        <path
                          d="M512 82.464153c-244.63772 0-442.955484 171.85302-442.955484 383.832945 0 125.44199 69.434395 236.8258 176.814008 306.863946-0.502443 56.870242 0.00307 168.373779 0.00307 168.373779s107.36938-70.083172 159.796426-102.527095c34.066887 7.272637 69.684082 11.135618 106.34198 11.135618 244.63772 0 442.955484-171.85302 442.955484-383.846248C954.955484 254.318196 756.63772 82.464153 512 82.464153zM299.631218 524.982686c-32.576953 0-58.988486-26.244734-58.988486-58.647725 0-32.386618 26.41051-58.652841 58.988486-58.652841s58.988486 26.266224 58.988486 58.652841C358.618681 498.737952 332.208171 524.982686 299.631218 524.982686zM520.987698 524.982686c-32.580023 0-58.988486-26.244734-58.988486-58.647725 0-32.386618 26.408463-58.652841 58.988486-58.652841 32.574906 0 58.988486 26.266224 58.988486 58.652841C579.976184 498.737952 553.562605 524.982686 520.987698 524.982686zM742.342132 524.982686c-32.574906 0-58.988486-26.244734-58.988486-58.647725 0-32.386618 26.41358-58.652841 58.988486-58.652841 32.576953 0 58.988486 26.266224 58.988486 58.652841C801.330618 498.737952 774.919085 524.982686 742.342132 524.982686z"
                          fill="#04b00f">
                        </path>
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="currentTreeHole !== null && treeHole.id === currentTreeHole.id"
                 style="padding: 0 25px 20px 60px">
              <comment :type="'jotting'" :source="treeHole.id" :userId="treeHole.userId"
                       @change="changeTotal"></comment>
            </div>
            <hr>
          </div>
        </div>
        <div class="pagination-wrap">
          <div @click="launch()" class="pagination" v-if="pagination.total !== treeHoleList.length">
            下一页
          </div>
          <div v-else style="user-select: none">
            ~~到底啦~~
          </div>
        </div>
      </div>

      <!-- 页脚 -->
      <myFooter :showFooter="showFooter"></myFooter>
    </div>

    <el-dialog title="随笔"
               :visible.sync="weiYanDialogVisible"
               width="40%"
               :before-close="handleClose"
               :append-to-body="true"
               destroy-on-close
               :close-on-click-modal="false"
               center>
      <div>
        <div class="myCenter" style="padding-bottom: 20px">
          <el-radio-group v-model="isPublic">
            <el-radio-button :label="true">公开</el-radio-button>
            <el-radio-button :label="false">私密</el-radio-button>
          </el-radio-group>
        </div>
        <commentBox :disableGraffiti="true"
                    @submitComment="submitWeiYan">
        </commentBox>
      </div>
    </el-dialog>
  </div>
</template>

<script>
const myFooter = () => import( "./common/myFooter");
const commentBox = () => import( "./comment/commentBox");
const comment = () => import( "./comment/comment");

export default {
  components: {
    myFooter,
    commentBox,
    comment,
  },

  data() {
    return {
      treeHoleList: [],
      currentTreeHole: null,
      pagination: {
        current: 1,
        size: 10,
        total: 0,
        userId: this.$constant.userId
      },
      weiYanDialogVisible: false,
      isPublic: true,
      showFooter: false
    }
  },

  computed: {},

  watch: {},

  created() {
    this.getWeiYan();
  },

  mounted() {

  },

  methods: {
    changeTotal(total) {
      this.currentTreeHole.commentCount = total;
    },
    openComment(treeHole) {
      if (this.currentTreeHole !== treeHole) {
        this.currentTreeHole = treeHole;
      } else {
        this.currentTreeHole = null;
      }
    },
    launch() {
      if (this.pagination.total !== this.treeHoleList.length) {
        this.pagination.current = this.pagination.current + 1;
        this.getWeiYan();
      } else {
        this.$message({
          message: "~~到底啦~~",
          type: "warning"
        });
      }
    },
    handleClose() {
      this.weiYanDialogVisible = false;
    },
    submitWeiYan(content) {
      let weiYan = {
        content: content,
        isPublic: this.isPublic
      };

      this.$http.post(this.$constant.baseURL + "/weiYan/saveWeiYan", weiYan)
        .then((res) => {
          this.getWeiYan(true);
        })
        .catch((error) => {
          this.$message({
            message: error.message,
            type: "error"
          });
        });
      this.handleClose();
    },
    deleteTreeHole(id) {
      if (this.$common.isEmpty(this.$store.state.currentUser)) {
        this.$message({
          message: "请先登录！",
          type: "error"
        });
        return;
      }

      this.$confirm('确认删除？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'success',
        center: true
      }).then(() => {
        this.$http.get(this.$constant.baseURL + "/weiYan/deleteWeiYan", {id: id})
          .then((res) => {
            this.$message({
              type: 'success',
              message: '删除成功!'
            });
            this.getWeiYan(true);
          })
          .catch((error) => {
            this.$message({
              message: error.message,
              type: "error"
            });
          });
      }).catch(() => {
        this.$message({
          type: 'success',
          message: '已取消删除!'
        });
      });
    },
    getWeiYan(reset) {
      this.$http.post(this.$constant.baseURL + "/weiYan/listWeiYan", this.pagination)
        .then((res) => {
          this.showFooter = false;
          if (!this.$common.isEmpty(res.data)) {
            res.data.records.forEach(c => {
              c.content = c.content.replace(/\n{2,}/g, '<div style="height: 12px"></div>');
              c.content = c.content.replace(/\n/g, '<br/>');
              c.content = this.$common.faceReg(c.content);
              c.content = this.$common.pictureReg(c.content);
            });
            if (reset) {
              this.pagination.current = 1;
              this.treeHoleList = [];
              this.currentTreeHole = null;
            }
            this.treeHoleList = this.treeHoleList.concat(res.data.records);
            this.pagination.total = res.data.total;
          }
          this.$nextTick(() => {
            this.showFooter = true;
            this.$common.imgShow(".jotting-content .pictureReg");
          });
        })
        .catch((error) => {
          this.$message({
            message: error.message,
            type: "error"
          });
        });
    }
  }
}
</script>

<style scoped>

.jotting-title {
  z-index: 10;
  letter-spacing: 4px;
  line-height: 40px;
  font-weight: bold;
  text-align: center;
  color: var(--white);
}

.jotting-image::before {
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: var(--translucent);
  content: "";
}

.jotting-info-news {
  position: absolute;
  bottom: 80px;
  right: 15%;
  cursor: pointer;
  animation: scale 1.5s ease-in-out infinite;
}

.jotting-container {
  background: var(--background);
  animation: slide-bottom 1s;
  background-image: linear-gradient(90deg, rgba(60, 10, 30, 0.05) 5%, transparent 0), linear-gradient(1turn, rgba(60, 10, 30, 0.05) 5%, transparent 0);
  background-size: 20px 20px;
}

.jotting-delete {
  margin-left: 10px;
  cursor: pointer;
}

.jotting-content {
  max-width: 700px;
  width: 80%;
  background: var(--background);
  border-radius: 12px;
  margin: 0 auto;
  padding: 15px 10px 30px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.07);
  position: relative;
  top: -60px;
}

.pagination-wrap {
  display: flex;
  justify-content: center;
  margin-top: 40px;
  font-size: 14px;
  font-weight: bold;
}

.pagination {
  padding: 7px 14px;
  border: 1px solid var(--lightGray);
  border-radius: 1rem;
  color: var(--greyFont);
  user-select: none;
  cursor: pointer;
}

.pagination:hover {
  border: 1px solid var(--themeBackground);
  color: var(--themeBackground);
  box-shadow: 0 0 5px var(--themeBackground);
}

.jotting-username {
  color: #607199;
  font-size: 16px;
  font-weight: 600;
  margin-right: 5px;
}

.jotting-lv {
  color: var(--green);
  border: 1px solid var(--green);
  border-radius: 0.2rem;
  font-size: 12px;
  padding: 2px 4px;
  margin-right: 5px;
}

.jotting-time {
  margin-top: 5px;
  font-size: 14px;
  color: var(--greyFont);
  user-select: none;
}

hr {
  position: relative;
  margin: 10px auto;
  border: 1px solid #f5f5f5;
  overflow: visible;
}

@media screen and (max-width: 700px) {

  .jotting-info-news {
    right: 20px;
  }

  .jotting-content {
    width: 100%;
  }
}

@media screen and (max-width: 450px) {

  .jotting-content {
    padding: 15px 0 30px;
  }
}

</style>
