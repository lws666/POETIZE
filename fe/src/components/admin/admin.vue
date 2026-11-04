<template>
  <div>
    <myHeader></myHeader>
    <sidebar></sidebar>
    <div class="content-box">
      <div class="admin-content">
        <router-view></router-view>
      </div>
    </div>
  </div>
</template>

<script>
  import myHeader from "./common/myHeader.vue";
  import sidebar from "./common/sidebar.vue";

  export default {
    components: {
      myHeader,
      sidebar
    },

    data() {
      return {}
    },

    computed: {},

    watch: {},

    created() {
      let sysConfig = this.$store.state.sysConfig;
      if (!this.$common.isEmpty(sysConfig) && !this.$common.isEmpty(sysConfig['webStaticResourcePrefix'])) {
        let webStaticResourcePrefix = sysConfig['webStaticResourcePrefix'];
        const font = new FontFace("poetize-font", "url(" + webStaticResourcePrefix + "assets/font.woff2)");
        font.load();
        document.fonts.add(font);
      }
    },

    mounted() {

    },

    methods: {}
  }
</script>

<style scoped>

  .content-box {
    position: absolute;
    left: 130px;
    right: 0;
    top: 70px;
    bottom: 0;
    transition: left .3s ease-in-out;
  }

  .admin-content {
    width: auto;
    height: 100%;
    padding: 30px;
    overflow-y: scroll;
  }

  @media screen and (max-width: 550px) {
    .admin-content {
      padding: 5px;
    }
  }

</style>
