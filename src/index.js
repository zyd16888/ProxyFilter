import yaml from 'js-yaml';

// 添加内存缓存系统
// 使用简单的Map来存储缓存内容
const CACHE = new Map();
// 默认缓存时间：30分钟（1800秒）
const DEFAULT_CACHE_TTL = 1800;

// 添加默认模板变量 - 直接内嵌config.yaml的内容
const DEFAULT_TEMPLATE_YAML = `
mixed-port: 7890
allow-lan: true
bind-address: '*'
mode: rule
log-level: info
external-controller: 127.0.0.1:9090
dns:
  enable: true
  ipv6: false
  default-nameserver:
  - 223.5.5.5
  - 119.29.29.29
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  use-hosts: true
  nameserver:
  - https://doh.pub/dns-query
  - https://dns.alidns.com/dns-query
  fallback:
  - https://doh.dns.sb/dns-query
  - https://dns.cloudflare.com/dns-query
  - https://dns.twnic.tw/dns-query
  - tls://8.8.4.4:853
  fallback-filter:
    geoip: true
    ipcidr:
    - 240.0.0.0/4
    - 0.0.0.0/32

proxy-groups:
- name: 手动选择
  type: select
  proxies:
  - 自动选择
  - 负载散列
  - 负载轮询
  - DIRECT

- name: 自动选择
  type: url-test
  proxies: []
  url: http://www.msftconnecttest.com/connecttest.txt
  interval: 3600
- name: 负载散列
  type: load-balance
  url: http://www.msftconnecttest.com/connecttest.txt
  interval: 3600
  strategy: consistent-hashing
  proxies: []
- name: 负载轮询
  type: load-balance
  url: http://www.msftconnecttest.com/connecttest.txt
  interval: 3600
  strategy: round-robin
  proxies: []
rules:
- DOMAIN,xn--6nq0hk9tdjr.com,DIRECT
- DOMAIN-SUFFIX,services.googleapis.cn,手动选择
- DOMAIN-SUFFIX,xn--ngstr-lra8j.com,手动选择
- DOMAIN,safebrowsing.urlsec.qq.com,DIRECT
- DOMAIN,safebrowsing.googleapis.com,DIRECT
- DOMAIN,developer.apple.com,手动选择
- DOMAIN-SUFFIX,digicert.com,手动选择
- DOMAIN,ocsp.apple.com,手动选择
- DOMAIN,ocsp.comodoca.com,手动选择
- DOMAIN,ocsp.usertrust.com,手动选择
- DOMAIN,ocsp.sectigo.com,手动选择
- DOMAIN,ocsp.verisign.net,手动选择
- DOMAIN-SUFFIX,apple-dns.net,手动选择
- DOMAIN,testflight.apple.com,手动选择
- DOMAIN,sandbox.itunes.apple.com,手动选择
- DOMAIN,itunes.apple.com,手动选择
- DOMAIN-SUFFIX,apps.apple.com,手动选择
- DOMAIN-SUFFIX,blobstore.apple.com,手动选择
- DOMAIN,cvws.icloud-content.com,手动选择
- DOMAIN-SUFFIX,mzstatic.com,DIRECT
- DOMAIN-SUFFIX,itunes.apple.com,DIRECT
- DOMAIN-SUFFIX,icloud.com,DIRECT
- DOMAIN-SUFFIX,icloud-content.com,DIRECT
- DOMAIN-SUFFIX,me.com,DIRECT
- DOMAIN-SUFFIX,aaplimg.com,DIRECT
- DOMAIN-SUFFIX,cdn20.com,DIRECT
- DOMAIN-SUFFIX,cdn-apple.com,DIRECT
- DOMAIN-SUFFIX,akadns.net,DIRECT
- DOMAIN-SUFFIX,akamaiedge.net,DIRECT
- DOMAIN-SUFFIX,edgekey.net,DIRECT
- DOMAIN-SUFFIX,mwcloudcdn.com,DIRECT
- DOMAIN-SUFFIX,mwcname.com,DIRECT
- DOMAIN-SUFFIX,apple.com,DIRECT
- DOMAIN-SUFFIX,apple-cloudkit.com,DIRECT
- DOMAIN-SUFFIX,apple-mapkit.com,DIRECT
- DOMAIN-SUFFIX,126.com,DIRECT
- DOMAIN-SUFFIX,126.net,DIRECT
- DOMAIN-SUFFIX,127.net,DIRECT
- DOMAIN-SUFFIX,163.com,DIRECT
- DOMAIN-SUFFIX,360buyimg.com,DIRECT
- DOMAIN-SUFFIX,36kr.com,DIRECT
- DOMAIN-SUFFIX,acfun.tv,DIRECT
- DOMAIN-SUFFIX,air-matters.com,DIRECT
- DOMAIN-SUFFIX,aixifan.com,DIRECT
- DOMAIN-KEYWORD,alicdn,DIRECT
- DOMAIN-KEYWORD,alipay,DIRECT
- DOMAIN-KEYWORD,taobao,DIRECT
- DOMAIN-SUFFIX,amap.com,DIRECT
- DOMAIN-SUFFIX,autonavi.com,DIRECT
- DOMAIN-KEYWORD,baidu,DIRECT
- DOMAIN-SUFFIX,bdimg.com,DIRECT
- DOMAIN-SUFFIX,bdstatic.com,DIRECT
- DOMAIN-SUFFIX,bilibili.com,DIRECT
- DOMAIN-SUFFIX,bilivideo.com,DIRECT
- DOMAIN-SUFFIX,caiyunapp.com,DIRECT
- DOMAIN-SUFFIX,clouddn.com,DIRECT
- DOMAIN-SUFFIX,cnbeta.com,DIRECT
- DOMAIN-SUFFIX,cnbetacdn.com,DIRECT
- DOMAIN-SUFFIX,cootekservice.com,DIRECT
- DOMAIN-SUFFIX,csdn.net,DIRECT
- DOMAIN-SUFFIX,ctrip.com,DIRECT
- DOMAIN-SUFFIX,dgtle.com,DIRECT
- DOMAIN-SUFFIX,dianping.com,DIRECT
- DOMAIN-SUFFIX,douban.com,DIRECT
- DOMAIN-SUFFIX,doubanio.com,DIRECT
- DOMAIN-SUFFIX,duokan.com,DIRECT
- DOMAIN-SUFFIX,easou.com,DIRECT
- DOMAIN-SUFFIX,ele.me,DIRECT
- DOMAIN-SUFFIX,feng.com,DIRECT
- DOMAIN-SUFFIX,fir.im,DIRECT
- DOMAIN-SUFFIX,frdic.com,DIRECT
- DOMAIN-SUFFIX,g-cores.com,DIRECT
- DOMAIN-SUFFIX,godic.net,DIRECT
- DOMAIN-SUFFIX,gtimg.com,DIRECT
- DOMAIN,cdn.hockeyapp.net,DIRECT
- DOMAIN-SUFFIX,hongxiu.com,DIRECT
- DOMAIN-SUFFIX,hxcdn.net,DIRECT
- DOMAIN-SUFFIX,iciba.com,DIRECT
- DOMAIN-SUFFIX,ifeng.com,DIRECT
- DOMAIN-SUFFIX,ifengimg.com,DIRECT
- DOMAIN-SUFFIX,ipip.net,DIRECT
- DOMAIN-SUFFIX,iqiyi.com,DIRECT
- DOMAIN-SUFFIX,jd.com,DIRECT
- DOMAIN-SUFFIX,jianshu.com,DIRECT
- DOMAIN-SUFFIX,knewone.com,DIRECT
- DOMAIN-SUFFIX,le.com,DIRECT
- DOMAIN-SUFFIX,lecloud.com,DIRECT
- DOMAIN-SUFFIX,lemicp.com,DIRECT
- DOMAIN-SUFFIX,licdn.com,DIRECT
- DOMAIN-SUFFIX,luoo.net,DIRECT
- DOMAIN-SUFFIX,meituan.com,DIRECT
- DOMAIN-SUFFIX,meituan.net,DIRECT
- DOMAIN-SUFFIX,mi.com,DIRECT
- DOMAIN-SUFFIX,miaopai.com,DIRECT
- DOMAIN-SUFFIX,microsoft.com,DIRECT
- DOMAIN-SUFFIX,microsoftonline.com,DIRECT
- DOMAIN-SUFFIX,miui.com,DIRECT
- DOMAIN-SUFFIX,miwifi.com,DIRECT
- DOMAIN-SUFFIX,mob.com,DIRECT
- DOMAIN-SUFFIX,netease.com,DIRECT
- DOMAIN-SUFFIX,office.com,DIRECT
- DOMAIN-SUFFIX,office365.com,DIRECT
- DOMAIN-KEYWORD,officecdn,DIRECT
- DOMAIN-SUFFIX,oschina.net,DIRECT
- DOMAIN-SUFFIX,ppsimg.com,DIRECT
- DOMAIN-SUFFIX,pstatp.com,DIRECT
- DOMAIN-SUFFIX,qcloud.com,DIRECT
- DOMAIN-SUFFIX,qdaily.com,DIRECT
- DOMAIN-SUFFIX,qdmm.com,DIRECT
- DOMAIN-SUFFIX,qhimg.com,DIRECT
- DOMAIN-SUFFIX,qhres.com,DIRECT
- DOMAIN-SUFFIX,qidian.com,DIRECT
- DOMAIN-SUFFIX,qihucdn.com,DIRECT
- DOMAIN-SUFFIX,qiniu.com,DIRECT
- DOMAIN-SUFFIX,qiniucdn.com,DIRECT
- DOMAIN-SUFFIX,qiyipic.com,DIRECT
- DOMAIN-SUFFIX,qq.com,DIRECT
- DOMAIN-SUFFIX,qqurl.com,DIRECT
- DOMAIN-SUFFIX,rarbg.to,DIRECT
- DOMAIN-SUFFIX,ruguoapp.com,DIRECT
- DOMAIN-SUFFIX,segmentfault.com,DIRECT
- DOMAIN-SUFFIX,sinaapp.com,DIRECT
- DOMAIN-SUFFIX,smzdm.com,DIRECT
- DOMAIN-SUFFIX,snapdrop.net,DIRECT
- DOMAIN-SUFFIX,sogou.com,DIRECT
- DOMAIN-SUFFIX,sogoucdn.com,DIRECT
- DOMAIN-SUFFIX,sohu.com,DIRECT
- DOMAIN-SUFFIX,soku.com,DIRECT
- DOMAIN-SUFFIX,speedtest.net,DIRECT
- DOMAIN-SUFFIX,sspai.com,DIRECT
- DOMAIN-SUFFIX,suning.com,DIRECT
- DOMAIN-SUFFIX,taobao.com,DIRECT
- DOMAIN-SUFFIX,tencent.com,DIRECT
- DOMAIN-SUFFIX,tenpay.com,DIRECT
- DOMAIN-SUFFIX,tianyancha.com,DIRECT
- DOMAIN-SUFFIX,tmall.com,DIRECT
- DOMAIN-SUFFIX,tudou.com,DIRECT
- DOMAIN-SUFFIX,umetrip.com,DIRECT
- DOMAIN-SUFFIX,upaiyun.com,DIRECT
- DOMAIN-SUFFIX,upyun.com,DIRECT
- DOMAIN-SUFFIX,veryzhun.com,DIRECT
- DOMAIN-SUFFIX,weather.com,DIRECT
- DOMAIN-SUFFIX,weibo.com,DIRECT
- DOMAIN-SUFFIX,xiami.com,DIRECT
- DOMAIN-SUFFIX,xiami.net,DIRECT
- DOMAIN-SUFFIX,xiaomicp.com,DIRECT
- DOMAIN-SUFFIX,ximalaya.com,DIRECT
- DOMAIN-SUFFIX,xmcdn.com,DIRECT
- DOMAIN-SUFFIX,xunlei.com,DIRECT
- DOMAIN-SUFFIX,yhd.com,DIRECT
- DOMAIN-SUFFIX,yihaodianimg.com,DIRECT
- DOMAIN-SUFFIX,yinxiang.com,DIRECT
- DOMAIN-SUFFIX,ykimg.com,DIRECT
- DOMAIN-SUFFIX,youdao.com,DIRECT
- DOMAIN-SUFFIX,youku.com,DIRECT
- DOMAIN-SUFFIX,zealer.com,DIRECT
- DOMAIN-SUFFIX,zhihu.com,DIRECT
- DOMAIN-SUFFIX,zhimg.com,DIRECT
- DOMAIN-SUFFIX,zimuzu.tv,DIRECT
- DOMAIN-SUFFIX,zoho.com,DIRECT
- DOMAIN-KEYWORD,amazon,手动选择
- DOMAIN-KEYWORD,google,手动选择
- DOMAIN-KEYWORD,gmail,手动选择
- DOMAIN-KEYWORD,youtube,手动选择
- DOMAIN-KEYWORD,facebook,手动选择
- DOMAIN-SUFFIX,fb.me,手动选择
- DOMAIN-SUFFIX,fbcdn.net,手动选择
- DOMAIN-KEYWORD,twitter,手动选择
- DOMAIN-KEYWORD,instagram,手动选择
- DOMAIN-KEYWORD,dropbox,手动选择
- DOMAIN-SUFFIX,twimg.com,手动选择
- DOMAIN-KEYWORD,blogspot,手动选择
- DOMAIN-SUFFIX,youtu.be,手动选择
- DOMAIN-KEYWORD,whatsapp,手动选择
- DOMAIN-KEYWORD,admarvel,REJECT
- DOMAIN-KEYWORD,admaster,REJECT
- DOMAIN-KEYWORD,adsage,REJECT
- DOMAIN-KEYWORD,adsmogo,REJECT
- DOMAIN-KEYWORD,adsrvmedia,REJECT
- DOMAIN-KEYWORD,adwords,REJECT
- DOMAIN-KEYWORD,adservice,REJECT
- DOMAIN-SUFFIX,appsflyer.com,REJECT
- DOMAIN-KEYWORD,domob,REJECT
- DOMAIN-SUFFIX,doubleclick.net,REJECT
- DOMAIN-KEYWORD,duomeng,REJECT
- DOMAIN-KEYWORD,dwtrack,REJECT
- DOMAIN-KEYWORD,guanggao,REJECT
- DOMAIN-KEYWORD,lianmeng,REJECT
- DOMAIN-SUFFIX,mmstat.com,REJECT
- DOMAIN-KEYWORD,mopub,REJECT
- DOMAIN-KEYWORD,omgmta,REJECT
- DOMAIN-KEYWORD,openx,REJECT
- DOMAIN-KEYWORD,partnerad,REJECT
- DOMAIN-KEYWORD,pingfore,REJECT
- DOMAIN-KEYWORD,supersonicads,REJECT
- DOMAIN-KEYWORD,uedas,REJECT
- DOMAIN-KEYWORD,umeng,REJECT
- DOMAIN-KEYWORD,usage,REJECT
- DOMAIN-SUFFIX,vungle.com,REJECT
- DOMAIN-KEYWORD,wlmonitor,REJECT
- DOMAIN-KEYWORD,zjtoolbar,REJECT
- DOMAIN-SUFFIX,9to5mac.com,手动选择
- DOMAIN-SUFFIX,abpchina.org,手动选择
- DOMAIN-SUFFIX,adblockplus.org,手动选择
- DOMAIN-SUFFIX,adobe.com,手动选择
- DOMAIN-SUFFIX,akamaized.net,手动选择
- DOMAIN-SUFFIX,alfredapp.com,手动选择
- DOMAIN-SUFFIX,amplitude.com,手动选择
- DOMAIN-SUFFIX,ampproject.org,手动选择
- DOMAIN-SUFFIX,android.com,手动选择
- DOMAIN-SUFFIX,angularjs.org,手动选择
- DOMAIN-SUFFIX,aolcdn.com,手动选择
- DOMAIN-SUFFIX,apkpure.com,手动选择
- DOMAIN-SUFFIX,appledaily.com,手动选择
- DOMAIN-SUFFIX,appshopper.com,手动选择
- DOMAIN-SUFFIX,appspot.com,手动选择
- DOMAIN-SUFFIX,arcgis.com,手动选择
- DOMAIN-SUFFIX,archive.org,手动选择
- DOMAIN-SUFFIX,armorgames.com,手动选择
- DOMAIN-SUFFIX,aspnetcdn.com,手动选择
- DOMAIN-SUFFIX,att.com,手动选择
- DOMAIN-SUFFIX,awsstatic.com,手动选择
- DOMAIN-SUFFIX,azureedge.net,手动选择
- DOMAIN-SUFFIX,azurewebsites.net,手动选择
- DOMAIN-SUFFIX,bing.com,手动选择
- DOMAIN-SUFFIX,bintray.com,手动选择
- DOMAIN-SUFFIX,bit.com,手动选择
- DOMAIN-SUFFIX,bit.ly,手动选择
- DOMAIN-SUFFIX,bitbucket.org,手动选择
- DOMAIN-SUFFIX,bjango.com,手动选择
- DOMAIN-SUFFIX,bkrtx.com,手动选择
- DOMAIN-SUFFIX,blog.com,手动选择
- DOMAIN-SUFFIX,blogcdn.com,手动选择
- DOMAIN-SUFFIX,blogger.com,手动选择
- DOMAIN-SUFFIX,blogsmithmedia.com,手动选择
- DOMAIN-SUFFIX,blogspot.com,手动选择
- DOMAIN-SUFFIX,blogspot.hk,手动选择
- DOMAIN-SUFFIX,bloomberg.com,手动选择
- DOMAIN-SUFFIX,box.com,手动选择
- DOMAIN-SUFFIX,box.net,手动选择
- DOMAIN-SUFFIX,cachefly.net,手动选择
- DOMAIN-SUFFIX,chromium.org,手动选择
- DOMAIN-SUFFIX,cl.ly,手动选择
- DOMAIN-SUFFIX,cloudflare.com,手动选择
- DOMAIN-SUFFIX,cloudfront.net,手动选择
- DOMAIN-SUFFIX,cloudmagic.com,手动选择
- DOMAIN-SUFFIX,cmail19.com,手动选择
- DOMAIN-SUFFIX,cnet.com,手动选择
- DOMAIN-SUFFIX,cocoapods.org,手动选择
- DOMAIN-SUFFIX,comodoca.com,手动选择
- DOMAIN-SUFFIX,crashlytics.com,手动选择
- DOMAIN-SUFFIX,culturedcode.com,手动选择
- DOMAIN-SUFFIX,d.pr,手动选择
- DOMAIN-SUFFIX,danilo.to,手动选择
- DOMAIN-SUFFIX,dayone.me,手动选择
- DOMAIN-SUFFIX,db.tt,手动选择
- DOMAIN-SUFFIX,deskconnect.com,手动选择
- DOMAIN-SUFFIX,disq.us,手动选择
- DOMAIN-SUFFIX,disqus.com,手动选择
- DOMAIN-SUFFIX,disquscdn.com,手动选择
- DOMAIN-SUFFIX,dnsimple.com,手动选择
- DOMAIN-SUFFIX,docker.com,手动选择
- DOMAIN-SUFFIX,dribbble.com,手动选择
- DOMAIN-SUFFIX,droplr.com,手动选择
- DOMAIN-SUFFIX,duckduckgo.com,手动选择
- DOMAIN-SUFFIX,dueapp.com,手动选择
- DOMAIN-SUFFIX,dytt8.net,手动选择
- DOMAIN-SUFFIX,edgecastcdn.net,手动选择
- DOMAIN-SUFFIX,edgekey.net,手动选择
- DOMAIN-SUFFIX,edgesuite.net,手动选择
- DOMAIN-SUFFIX,engadget.com,手动选择
- DOMAIN-SUFFIX,entrust.net,手动选择
- DOMAIN-SUFFIX,eurekavpt.com,手动选择
- DOMAIN-SUFFIX,evernote.com,手动选择
- DOMAIN-SUFFIX,fabric.io,手动选择
- DOMAIN-SUFFIX,fast.com,手动选择
- DOMAIN-SUFFIX,fastly.net,手动选择
- DOMAIN-SUFFIX,fc2.com,手动选择
- DOMAIN-SUFFIX,feedburner.com,手动选择
- DOMAIN-SUFFIX,feedly.com,手动选择
- DOMAIN-SUFFIX,feedsportal.com,手动选择
- DOMAIN-SUFFIX,fiftythree.com,手动选择
- DOMAIN-SUFFIX,firebaseio.com,手动选择
- DOMAIN-SUFFIX,flexibits.com,手动选择
- DOMAIN-SUFFIX,flickr.com,手动选择
- DOMAIN-SUFFIX,flipboard.com,手动选择
- DOMAIN-SUFFIX,g.co,手动选择
- DOMAIN-SUFFIX,gabia.net,手动选择
- DOMAIN-SUFFIX,geni.us,手动选择
- DOMAIN-SUFFIX,gfx.ms,手动选择
- DOMAIN-SUFFIX,ggpht.com,手动选择
- DOMAIN-SUFFIX,ghostnoteapp.com,手动选择
- DOMAIN-SUFFIX,git.io,手动选择
- DOMAIN-KEYWORD,github,手动选择
- DOMAIN-SUFFIX,globalsign.com,手动选择
- DOMAIN-SUFFIX,gmodules.com,手动选择
- DOMAIN-SUFFIX,godaddy.com,手动选择
- DOMAIN-SUFFIX,golang.org,手动选择
- DOMAIN-SUFFIX,gongm.in,手动选择
- DOMAIN-SUFFIX,goo.gl,手动选择
- DOMAIN-SUFFIX,goodreaders.com,手动选择
- DOMAIN-SUFFIX,goodreads.com,手动选择
- DOMAIN-SUFFIX,gravatar.com,手动选择
- DOMAIN-SUFFIX,gstatic.com,手动选择
- DOMAIN-SUFFIX,gvt0.com,手动选择
- DOMAIN-SUFFIX,hockeyapp.net,手动选择
- DOMAIN-SUFFIX,hotmail.com,手动选择
- DOMAIN-SUFFIX,icons8.com,手动选择
- DOMAIN-SUFFIX,ifixit.com,手动选择
- DOMAIN-SUFFIX,ift.tt,手动选择
- DOMAIN-SUFFIX,ifttt.com,手动选择
- DOMAIN-SUFFIX,iherb.com,手动选择
- DOMAIN-SUFFIX,imageshack.us,手动选择
- DOMAIN-SUFFIX,img.ly,手动选择
- DOMAIN-SUFFIX,imgur.com,手动选择
- DOMAIN-SUFFIX,imore.com,手动选择
- DOMAIN-SUFFIX,instapaper.com,手动选择
- DOMAIN-SUFFIX,ipn.li,手动选择
- DOMAIN-SUFFIX,is.gd,手动选择
- DOMAIN-SUFFIX,issuu.com,手动选择
- DOMAIN-SUFFIX,itgonglun.com,手动选择
- DOMAIN-SUFFIX,itun.es,手动选择
- DOMAIN-SUFFIX,ixquick.com,手动选择
- DOMAIN-SUFFIX,j.mp,手动选择
- DOMAIN-SUFFIX,js.revsci.net,手动选择
- DOMAIN-SUFFIX,jshint.com,手动选择
- DOMAIN-SUFFIX,jtvnw.net,手动选择
- DOMAIN-SUFFIX,justgetflux.com,手动选择
- DOMAIN-SUFFIX,kat.cr,手动选择
- DOMAIN-SUFFIX,klip.me,手动选择
- DOMAIN-SUFFIX,libsyn.com,手动选择
- DOMAIN-SUFFIX,linkedin.com,手动选择
- DOMAIN-SUFFIX,line-apps.com,手动选择
- DOMAIN-SUFFIX,linode.com,手动选择
- DOMAIN-SUFFIX,lithium.com,手动选择
- DOMAIN-SUFFIX,littlehj.com,手动选择
- DOMAIN-SUFFIX,live.com,手动选择
- DOMAIN-SUFFIX,live.net,手动选择
- DOMAIN-SUFFIX,livefilestore.com,手动选择
- DOMAIN-SUFFIX,llnwd.net,手动选择
- DOMAIN-SUFFIX,macid.co,手动选择
- DOMAIN-SUFFIX,macromedia.com,手动选择
- DOMAIN-SUFFIX,macrumors.com,手动选择
- DOMAIN-SUFFIX,mashable.com,手动选择
- DOMAIN-SUFFIX,mathjax.org,手动选择
- DOMAIN-SUFFIX,medium.com,手动选择
- DOMAIN-SUFFIX,mega.co.nz,手动选择
- DOMAIN-SUFFIX,mega.nz,手动选择
- DOMAIN-SUFFIX,megaupload.com,手动选择
- DOMAIN-SUFFIX,microsofttranslator.com,手动选择
- DOMAIN-SUFFIX,mindnode.com,手动选择
- DOMAIN-SUFFIX,mobile01.com,手动选择
- DOMAIN-SUFFIX,modmyi.com,手动选择
- DOMAIN-SUFFIX,msedge.net,手动选择
- DOMAIN-SUFFIX,myfontastic.com,手动选择
- DOMAIN-SUFFIX,name.com,手动选择
- DOMAIN-SUFFIX,nextmedia.com,手动选择
- DOMAIN-SUFFIX,nsstatic.net,手动选择
- DOMAIN-SUFFIX,nssurge.com,手动选择
- DOMAIN-SUFFIX,nyt.com,手动选择
- DOMAIN-SUFFIX,nytimes.com,手动选择
- DOMAIN-SUFFIX,omnigroup.com,手动选择
- DOMAIN-SUFFIX,onedrive.com,手动选择
- DOMAIN-SUFFIX,onenote.com,手动选择
- DOMAIN-SUFFIX,ooyala.com,手动选择
- DOMAIN-SUFFIX,openvpn.net,手动选择
- DOMAIN-SUFFIX,openwrt.org,手动选择
- DOMAIN-SUFFIX,orkut.com,手动选择
- DOMAIN-SUFFIX,osxdaily.com,手动选择
- DOMAIN-SUFFIX,outlook.com,手动选择
- DOMAIN-SUFFIX,ow.ly,手动选择
- DOMAIN-SUFFIX,paddleapi.com,手动选择
- DOMAIN-SUFFIX,parallels.com,手动选择
- DOMAIN-SUFFIX,parse.com,手动选择
- DOMAIN-SUFFIX,pdfexpert.com,手动选择
- DOMAIN-SUFFIX,periscope.tv,手动选择
- DOMAIN-SUFFIX,pinboard.in,手动选择
- DOMAIN-SUFFIX,pinterest.com,手动选择
- DOMAIN-SUFFIX,pixelmator.com,手动选择
- DOMAIN-SUFFIX,pixiv.net,手动选择
- DOMAIN-SUFFIX,playpcesor.com,手动选择
- DOMAIN-SUFFIX,playstation.com,手动选择
- DOMAIN-SUFFIX,playstation.com.hk,手动选择
- DOMAIN-SUFFIX,playstation.net,手动选择
- DOMAIN-SUFFIX,playstationnetwork.com,手动选择
- DOMAIN-SUFFIX,pushwoosh.com,手动选择
- DOMAIN-SUFFIX,rime.im,手动选择
- DOMAIN-SUFFIX,servebom.com,手动选择
- DOMAIN-SUFFIX,sfx.ms,手动选择
- DOMAIN-SUFFIX,shadowsocks.org,手动选择
- DOMAIN-SUFFIX,sharethis.com,手动选择
- DOMAIN-SUFFIX,shazam.com,手动选择
- DOMAIN-SUFFIX,skype.com,手动选择
- DOMAIN-SUFFIX,smartdns手动选择.com,手动选择
- DOMAIN-SUFFIX,smartmailcloud.com,手动选择
- DOMAIN-SUFFIX,sndcdn.com,手动选择
- DOMAIN-SUFFIX,sony.com,手动选择
- DOMAIN-SUFFIX,soundcloud.com,手动选择
- DOMAIN-SUFFIX,sourceforge.net,手动选择
- DOMAIN-SUFFIX,spotify.com,手动选择
- DOMAIN-SUFFIX,squarespace.com,手动选择
- DOMAIN-SUFFIX,sstatic.net,手动选择
- DOMAIN-SUFFIX,st.luluku.pw,手动选择
- DOMAIN-SUFFIX,stackoverflow.com,手动选择
- DOMAIN-SUFFIX,startpage.com,手动选择
- DOMAIN-SUFFIX,staticflickr.com,手动选择
- DOMAIN-SUFFIX,steamcommunity.com,手动选择
- DOMAIN-SUFFIX,symauth.com,手动选择
- DOMAIN-SUFFIX,symcb.com,手动选择
- DOMAIN-SUFFIX,symcd.com,手动选择
- DOMAIN-SUFFIX,tapbots.com,手动选择
- DOMAIN-SUFFIX,tapbots.net,手动选择
- DOMAIN-SUFFIX,tdesktop.com,手动选择
- DOMAIN-SUFFIX,techcrunch.com,手动选择
- DOMAIN-SUFFIX,techsmith.com,手动选择
- DOMAIN-SUFFIX,thepiratebay.org,手动选择
- DOMAIN-SUFFIX,theverge.com,手动选择
- DOMAIN-SUFFIX,time.com,手动选择
- DOMAIN-SUFFIX,timeinc.net,手动选择
- DOMAIN-SUFFIX,tiny.cc,手动选择
- DOMAIN-SUFFIX,tinypic.com,手动选择
- DOMAIN-SUFFIX,tmblr.co,手动选择
- DOMAIN-SUFFIX,todoist.com,手动选择
- DOMAIN-SUFFIX,trello.com,手动选择
- DOMAIN-SUFFIX,trustasiassl.com,手动选择
- DOMAIN-SUFFIX,tumblr.co,手动选择
- DOMAIN-SUFFIX,tumblr.com,手动选择
- DOMAIN-SUFFIX,tweetdeck.com,手动选择
- DOMAIN-SUFFIX,tweetmarker.net,手动选择
- DOMAIN-SUFFIX,twitch.tv,手动选择
- DOMAIN-SUFFIX,txmblr.com,手动选择
- DOMAIN-SUFFIX,typekit.net,手动选择
- DOMAIN-SUFFIX,ubertags.com,手动选择
- DOMAIN-SUFFIX,ublock.org,手动选择
- DOMAIN-SUFFIX,ubnt.com,手动选择
- DOMAIN-SUFFIX,ulyssesapp.com,手动选择
- DOMAIN-SUFFIX,urchin.com,手动选择
- DOMAIN-SUFFIX,usertrust.com,手动选择
- DOMAIN-SUFFIX,v.gd,手动选择
- DOMAIN-SUFFIX,v2ex.com,手动选择
- DOMAIN-SUFFIX,vimeo.com,手动选择
- DOMAIN-SUFFIX,vimeocdn.com,手动选择
- DOMAIN-SUFFIX,vine.co,手动选择
- DOMAIN-SUFFIX,vivaldi.com,手动选择
- DOMAIN-SUFFIX,vox-cdn.com,手动选择
- DOMAIN-SUFFIX,vsco.co,手动选择
- DOMAIN-SUFFIX,vultr.com,手动选择
- DOMAIN-SUFFIX,w.org,手动选择
- DOMAIN-SUFFIX,w3schools.com,手动选择
- DOMAIN-SUFFIX,webtype.com,手动选择
- DOMAIN-SUFFIX,wikiwand.com,手动选择
- DOMAIN-SUFFIX,wikileaks.org,手动选择
- DOMAIN-SUFFIX,wikimedia.org,手动选择
- DOMAIN-SUFFIX,wikipedia.com,手动选择
- DOMAIN-SUFFIX,wikipedia.org,手动选择
- DOMAIN-SUFFIX,windows.com,手动选择
- DOMAIN-SUFFIX,windows.net,手动选择
- DOMAIN-SUFFIX,wire.com,手动选择
- DOMAIN-SUFFIX,wordpress.com,手动选择
- DOMAIN-SUFFIX,workflowy.com,手动选择
- DOMAIN-SUFFIX,wp.com,手动选择
- DOMAIN-SUFFIX,wsj.com,手动选择
- DOMAIN-SUFFIX,wsj.net,手动选择
- DOMAIN-SUFFIX,xda-developers.com,手动选择
- DOMAIN-SUFFIX,xeeno.com,手动选择
- DOMAIN-SUFFIX,xiti.com,手动选择
- DOMAIN-SUFFIX,yahoo.com,手动选择
- DOMAIN-SUFFIX,yimg.com,手动选择
- DOMAIN-SUFFIX,ying.com,手动选择
- DOMAIN-SUFFIX,yoyo.org,手动选择
- DOMAIN-SUFFIX,ytimg.com,手动选择
- DOMAIN-SUFFIX,telegra.ph,手动选择
- DOMAIN-SUFFIX,telegram.org,手动选择
- IP-CIDR,91.108.4.0/22,手动选择,no-resolve
- IP-CIDR,91.108.8.0/21,手动选择,no-resolve
- IP-CIDR,91.108.16.0/22,手动选择,no-resolve
- IP-CIDR,91.108.56.0/22,手动选择,no-resolve
- IP-CIDR,149.154.160.0/20,手动选择,no-resolve
- IP-CIDR6,2001:67c:4e8::/48,手动选择,no-resolve
- IP-CIDR6,2001:b28:f23d::/48,手动选择,no-resolve
- IP-CIDR6,2001:b28:f23f::/48,手动选择,no-resolve
- IP-CIDR,120.232.181.162/32,手动选择,no-resolve
- IP-CIDR,120.241.147.226/32,手动选择,no-resolve
- IP-CIDR,120.253.253.226/32,手动选择,no-resolve
- IP-CIDR,120.253.255.162/32,手动选择,no-resolve
- IP-CIDR,120.253.255.34/32,手动选择,no-resolve
- IP-CIDR,120.253.255.98/32,手动选择,no-resolve
- IP-CIDR,180.163.150.162/32,手动选择,no-resolve
- IP-CIDR,180.163.150.34/32,手动选择,no-resolve
- IP-CIDR,180.163.151.162/32,手动选择,no-resolve
- IP-CIDR,180.163.151.34/32,手动选择,no-resolve
- IP-CIDR,203.208.39.0/24,手动选择,no-resolve
- IP-CIDR,203.208.40.0/24,手动选择,no-resolve
- IP-CIDR,203.208.41.0/24,手动选择,no-resolve
- IP-CIDR,203.208.43.0/24,手动选择,no-resolve
- IP-CIDR,203.208.50.0/24,手动选择,no-resolve
- IP-CIDR,220.181.174.162/32,手动选择,no-resolve
- IP-CIDR,220.181.174.226/32,手动选择,no-resolve
- IP-CIDR,220.181.174.34/32,手动选择,no-resolve
- DOMAIN,injections.adguard.org,DIRECT
- DOMAIN,local.adguard.org,DIRECT
- DOMAIN-SUFFIX,local,DIRECT
- IP-CIDR,127.0.0.0/8,DIRECT
- IP-CIDR,172.16.0.0/12,DIRECT
- IP-CIDR,192.168.0.0/16,DIRECT
- IP-CIDR,10.0.0.0/8,DIRECT
- IP-CIDR,17.0.0.0/8,DIRECT
- IP-CIDR,100.64.0.0/10,DIRECT
- IP-CIDR,224.0.0.0/4,DIRECT
- IP-CIDR6,fe80::/10,DIRECT
- DOMAIN-SUFFIX,cn,DIRECT
- DOMAIN-KEYWORD,-cn,DIRECT
- GEOIP,CN,DIRECT
- MATCH,手动选择
`;

// 初始化默认模板
let DEFAULT_TEMPLATE = null;
try {
  DEFAULT_TEMPLATE = yaml.load(DEFAULT_TEMPLATE_YAML);
  console.log('成功加载默认配置模板');
} catch (err) {
  console.warn('加载默认配置模板失败:', err.message);
}

// 缓存项结构
class CacheItem {
  constructor(data, ttl = DEFAULT_CACHE_TTL) {
    this.data = data;
    this.expires = Date.now() + ttl * 1000;
  }
  
  isExpired() {
    return Date.now() > this.expires;
  }
}

// 缓存管理函数
function getCachedData(key) {
  const item = CACHE.get(key);
  if (!item) return null;
  
  // 如果缓存过期，删除并返回null
  if (item.isExpired()) {
    CACHE.delete(key);
    return null;
  }
  
  return item.data;
}

function setCachedData(key, data, ttl = DEFAULT_CACHE_TTL) {
  CACHE.set(key, new CacheItem(data, ttl));
}

// 清理过期缓存的函数 - 可以在Worker初始化时或定期调用
function cleanupCache() {
  for (const [key, item] of CACHE.entries()) {
    if (item.isExpired()) {
      CACHE.delete(key);
    }
  }
}

// 计算缓存键的函数 - 包含URL和查询参数等关键信息
function getCacheKey(url, params = {}) {
  return `${url}:${JSON.stringify(params)}`;
}

export default {
  async fetch(request, env, ctx) {
    // 设置 CORS 头部
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // 处理 OPTIONS 请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 获取请求 URL 和路径
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // 快速路径：处理常见的特殊请求
    if (pathname === '/favicon.ico') {
      return new Response(null, { status: 204 }); // 返回无内容响应
    }
    
    if (pathname === '/robots.txt') {
      return new Response('User-agent: *\nDisallow: /', {
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    if (pathname !== '/') {
      return new Response('Not Found', {
          status: 404,
          headers: corsHeaders
        });
      }

    // 获取完整的原始查询字符串
    const queryString = url.search;
    
    // 从原始查询字符串中提取 yamlUrl 参数的完整值
    let yamlUrlParam = null;
    const urlMatch = queryString.match(/[?&]url=([^&]+)/);
    if (urlMatch && urlMatch[1]) {
      // 解码URL参数
      yamlUrlParam = decodeURIComponent(urlMatch[1]);
      
      // 处理直接提供的Base64数据内容
      if (yamlUrlParam.startsWith('data:') && yamlUrlParam.includes('base64,')) {
        try {
          const base64Content = yamlUrlParam.split('base64,')[1];
          const decodedContent = atob(base64Content);
          
          // 处理解码后的内容
          return await processDirectContent(decodedContent, url, env, corsHeaders);
      } catch (e) {
          return new Response(`Error processing Base64 content: ${e.message}`, {
          status: 400,
          headers: corsHeaders
        });
        }
      }
    }
    
    // 使用标准方法获取其他参数
    let nameFilter = url.searchParams.get('name');
    let typeFilter = url.searchParams.get('type');
    let templateUrl = url.searchParams.get('template'); // 模板配置URL参数
    let templateContent = url.searchParams.get('template_content'); // 新增: 直接传递的模板内容
    let serverFilter = url.searchParams.get('server'); // 新增: 服务器类型过滤参数(domain或ip)
    let limit = parseInt(url.searchParams.get('limit'), 10) || 8; // 新增: 限制采集URL数量的参数，默认为8
    
    // 如果未提供参数，尝试使用环境变量中的默认值
    // 环境变量优先级: URL参数 > 环境变量
    if (!yamlUrlParam && env.DEFAULT_URL) {
      yamlUrlParam = env.DEFAULT_URL;
    }
    
    if (!nameFilter && env.DEFAULT_NAME_FILTER) {
      nameFilter = env.DEFAULT_NAME_FILTER;
    }
    
    if (!typeFilter && env.DEFAULT_TYPE_FILTER) {
      typeFilter = env.DEFAULT_TYPE_FILTER;
    }

    if (!templateUrl && env.DEFAULT_TEMPLATE_URL) {
      templateUrl = env.DEFAULT_TEMPLATE_URL;
    }

    if (!serverFilter && env.DEFAULT_SERVER_FILTER) {
      serverFilter = env.DEFAULT_SERVER_FILTER;
    }
    
    // 强制应用环境变量中的过滤器（如果存在）
    // 这些过滤器会与用户提供的过滤器一起应用
    const forceNameFilter = env.FORCE_NAME_FILTER;
    const forceTypeFilter = env.FORCE_TYPE_FILTER;
    const forceServerFilter = env.FORCE_SERVER_FILTER; // 新增: 强制服务器类型过滤

    // 验证必要参数
    if (!yamlUrlParam) {
      return new Response('Error: Missing required parameter "url" or DEFAULT_URL environment variable', {
          status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8'
        }
      });
    }
    
    // 分割多URL参数（用逗号分隔）
    let yamlUrls = yamlUrlParam.split(',').map(u => u.trim()).filter(u => u);

    // 如果是从默认URL获取的，并且设置了limit参数，则进行截取
    if (yamlUrlParam === env.DEFAULT_URL && limit > 0) {
      yamlUrls = yamlUrls.slice(0, limit);
    }
    
    // 限制URL数量，避免过多处理
    if (yamlUrls.length > 100) {
      return new Response('Error: Too many URLs provided (maximum 100 allowed)', {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8'
        }
      });
    }

    try {
      // 合并配置结果
      let mergedProxies = [];
      let firstConfig = null;
      let templateConfig = null; // 存储模板配置
      let totalOriginalCount = 0;
      let sourceUrlInfo = [];
      
      // 定义缓存选项
      const cacheOptions = {
        useCache: true,
        cacheTTL: env.CACHE_TTL ? parseInt(env.CACHE_TTL) : DEFAULT_CACHE_TTL
      };
      
      // 优先使用内置默认模板
      if (DEFAULT_TEMPLATE) {
        templateConfig = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE)); // 深拷贝以避免修改原始对象
        sourceUrlInfo.push(`使用内置默认模板`);
      }
      
      // 如果提供了模板URL，尝试获取模板配置（会覆盖默认模板）
      if (templateUrl) {
        try {
          const templateResult = await fetchAndParseYaml(templateUrl, cacheOptions);
          if (templateResult.error) {
            sourceUrlInfo.push(`模板(${templateUrl}): 错误: ${templateResult.error}`);
          } else if (templateResult.config) {
            templateConfig = templateResult.config;
            sourceUrlInfo.push(`模板(${templateUrl}): 成功加载`);
          }
        } catch (templateError) {
          sourceUrlInfo.push(`模板(${templateUrl}): 错误: ${templateError.message}`);
        }
      }
      
      // 并行处理所有URL（而不是串行）
      const configPromises = yamlUrls.map(yamlUrl => 
        fetchAndParseYaml(yamlUrl, cacheOptions)
          .then(result => ({ yamlUrl, ...result }))
          .catch(e => ({ yamlUrl, error: e.message }))
      );
      
      // 等待所有请求完成
      const results = await Promise.all(configPromises);
      
      // 处理所有结果
      for (const result of results) {
        const { yamlUrl, config, error } = result;
        
        if (error) {
          sourceUrlInfo.push(`${yamlUrl} (错误: ${error})`);
          continue;
        }
        
        // 初始化第一个有效配置作为基础配置
        if (!firstConfig && config) {
          firstConfig = config;
        }
        
        // 添加代理到合并列表
        if (config && config.proxies && Array.isArray(config.proxies)) {
          totalOriginalCount += config.proxies.length;
          mergedProxies = [...mergedProxies, ...config.proxies];
          sourceUrlInfo.push(`${yamlUrl} (${config.proxies.length}个节点)`);
          
          // 限制处理节点数量，避免超出CPU限制
          if (totalOriginalCount > 100000) {
            return new Response('Error: Too many proxies to process (limit: 100000)', {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'text/plain; charset=utf-8'
              }
            });
          }
        }
      }
      
      // 验证是否有有效的配置或模板
      if (!firstConfig && !templateConfig) {
        return new Response('Error: No valid configuration found from the provided URLs or template', {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/plain; charset=utf-8'
          }
        });
      }

      // 优先使用模板配置，如果存在
      if (templateConfig) {
        firstConfig = templateConfig;
      }

      // 验证是否有代理节点
      if (mergedProxies.length === 0) {
        return new Response('Error: No proxies found in the configurations', {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/plain; charset=utf-8'
          }
        });
      }

      // 节点去重
      const beforeDedupeCount = mergedProxies.length;
      mergedProxies = deduplicateProxies(mergedProxies);
      const afterDedupeCount = mergedProxies.length;
      const duplicateCount = beforeDedupeCount - afterDedupeCount;
      
      // 验证和修复节点
      const beforeValidateCount = mergedProxies.length;
      mergedProxies = validateProxies(mergedProxies);
      const afterValidateCount = mergedProxies.length;
      const invalidCount = beforeValidateCount - afterValidateCount;
      
      // 构建有效的过滤器
      const effectiveNameFilter = combineFilters(nameFilter, forceNameFilter);
      const effectiveTypeFilter = combineFilters(typeFilter, forceTypeFilter);
      const effectiveServerFilter = combineFilters(serverFilter, forceServerFilter);

      // 过滤节点
      let filteredProxies = filterProxies(
        mergedProxies, 
        effectiveNameFilter, 
        effectiveTypeFilter,
        effectiveServerFilter
      );
      
      // 重命名节点，使用名称过滤条件
      filteredProxies = renameProxies(filteredProxies, nameFilter);
      
      // 记录过滤后节点数量
      const filteredCount = filteredProxies.length;
      
      // 创建新的配置 - 使用模板或第一个配置
      const filteredConfig = {...firstConfig, proxies: filteredProxies};
      
      // 如果有 proxy-groups，更新它们以包含过滤后的节点
      if (firstConfig['proxy-groups'] && Array.isArray(firstConfig['proxy-groups'])) {
        filteredConfig['proxy-groups'] = updateProxyGroups(
          firstConfig['proxy-groups'], 
          filteredProxies.map(p => p.name)
        );
      }

      // 添加过滤信息作为注释
      let filterInfo = `# 原始节点总计: ${totalOriginalCount}, 去重后: ${afterDedupeCount} (移除了${duplicateCount}个重复节点), 无效节点: ${invalidCount}, 过滤后节点: ${filteredCount}\n` +
                       `# 名称过滤: ${nameFilter || '无'} ${forceNameFilter ? '(强制: ' + forceNameFilter + ')' : ''}\n` +
                       `# 类型过滤: ${typeFilter || '无'} ${forceTypeFilter ? '(强制: ' + forceTypeFilter + ')' : ''}\n` +
                       `# 服务器类型过滤: ${serverFilter || '无'} ${forceServerFilter ? '(强制: ' + forceServerFilter + ')' : ''}\n` +
                       `# 生成时间: ${new Date().toISOString()}\n` +
                       `# 配置源: \n# ${sourceUrlInfo.join('\n# ')}\n`;
      
      // 生成 YAML 并返回
      const yamlString = filterInfo + yaml.dump(filteredConfig);
      
      // 清理过期缓存（定期进行）
      if (Math.random() < 0.1) { // 约10%的请求会触发清理
        cleanupCache();
      }
      
      return new Response(yamlString, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/yaml; charset=utf-8'
        }
      });
    } catch (error) {
      // 增加详细的错误日志
      console.error(`处理错误: ${error.message}`, error.stack);
      
      // 返回更详细的错误信息
      const errorMessage = `Error: ${error.message}\n\nStack: ${error.stack || 'No stack trace'}\n`;
      return new Response(errorMessage, {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8'
        }
      });
    }
  }
};

/**
 * 获取并解析 YAML 配置
 * @param {string} yamlUrl YAML 配置URL
 * @param {Object} options 额外选项，如缓存控制
 * @returns {Object} 包含配置对象或错误信息
 */
async function fetchAndParseYaml(yamlUrl, options = {}) {
  // 从选项中获取缓存设置，默认启用缓存
  const useCache = options.useCache !== false;
  const cacheTTL = options.cacheTTL || DEFAULT_CACHE_TTL;
  
  // 生成缓存键
  const cacheKey = getCacheKey(yamlUrl, options);
  
  // 如果启用缓存，先检查内存缓存
  if (useCache) {
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      console.log(`使用缓存的结果: ${yamlUrl}`);
      return cachedResult;
    }
  }
  
  try {
    // 设置获取超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
    
    // 构建请求选项，添加更好的缓存控制
    const fetchOptions = {
      signal: controller.signal,
      cf: { 
        cacheTtl: cacheTTL,
        cacheEverything: true
      },
      headers: {
        // 添加常见的浏览器请求头，避免被某些服务器拒绝
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml,text/plain,*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        // 请求缓存控制
        'Cache-Control': 'max-age=0'
      }
    };
    
    // 获取 YAML 配置
    const response = await fetch(yamlUrl, fetchOptions).catch(err => {
      if (err.name === 'AbortError') {
        return { ok: false, status: 408, statusText: 'Request Timeout' };
      }
      throw err;
    });
    
    clearTimeout(timeoutId); // 清除超时
    
    if (!response.ok) {
      const errorResult = { 
        error: `HTTP ${response.status} ${response.statusText}`
      };
      
      // 对于某些错误（如503、502等），仍然尝试使用较短时间的缓存
      if (useCache && [502, 503, 504, 429].includes(response.status)) {
        setCachedData(cacheKey, errorResult, 60); // 缓存1分钟
      }
      
      return errorResult;
    }

    let content = await response.text();
    
    // 特殊处理：检查URL是否是已知的V2Ray格式订阅
    if (yamlUrl.includes('githubusercontent.com') && 
        (yamlUrl.includes('/v2rayfree/') || 
         yamlUrl.includes('/aiboboxx/') || 
         yamlUrl.includes('/freefq/'))) {
      console.log("检测到已知的V2Ray订阅格式，使用特殊处理");
      
      // 这些订阅通常是单行Base64编码的SS/V2Ray节点
      if (content && content.trim() && /^[A-Za-z0-9+/=\s]+$/.test(content.trim())) {
        try {
          const decodedContent = atob(content.replace(/\s/g, ''));
          if (decodedContent.includes('ss://') || 
              decodedContent.includes('vmess://') || 
              decodedContent.includes('trojan://')) {
            
            // 解码成功，尝试解析节点
            const nodeConfig = parseURIListToConfig(decodedContent);
            if (nodeConfig && nodeConfig.proxies && nodeConfig.proxies.length > 0) {
              const result = { config: nodeConfig };
              // 缓存成功的结果
              if (useCache) {
                setCachedData(cacheKey, result, cacheTTL);
              }
              return result;
            } else {
              const errorResult = { error: `解析到${decodedContent.split(/\r?\n/).filter(Boolean).length}行内容，但未能提取有效节点` };
              return errorResult;
            }
          }
        } catch (e) {
          return { error: `解析V2Ray订阅格式失败: ${e.message}` };
        }
      }
    }
    
    // 特殊处理: aiboboxx/clashfree 链接，已知可能包含HTML标记
    if (yamlUrl.includes('githubusercontent.com') && yamlUrl.includes('/aiboboxx/clashfree/')) {
      console.log("检测到 aiboboxx/clashfree 链接，应用特殊处理");
      
      // 检查内容是否有HTML或样式标记
      if (content.includes('style=') || content.includes('<div') || content.includes('white-space: pre-wrap')) {
        console.log("检测到HTML或样式标记，进行特殊清理");
        
        // 先尝试提取YAML部分
        const lines = content.split(/\r?\n/);
        let startLine = 0;
        
        // 寻找YAML开始的位置（通常以 mixed-port: 开头）
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('mixed-port:') || lines[i].includes('port:')) {
            startLine = i;
            break;
          }
        }
        
        // 提取从 startLine 开始的所有内容
        const extractedContent = lines.slice(startLine).join('\n');
        
        // 清理HTML标签和样式
        let cleanedContent = extractedContent
          .replace(/<[^>]*>/g, '') // 移除HTML标签
          .replace(/style="[^"]*"/g, '') // 移除样式属性
          .replace(/&[a-z]+;/g, ' '); // 替换HTML实体
        
        // 尝试解析清理后的内容
        try {
          const config = yaml.load(cleanedContent);
          if (config && typeof config === 'object') {
            if (!config.proxies) {
              config.proxies = [];
            }
            const result = { config };
            if (useCache) {
              setCachedData(cacheKey, result, cacheTTL);
            }
            return result;
          }
        } catch (err) {
          console.warn("清理后内容解析失败:", err.message);
          // 如果清理后仍然解析失败，回退到标准处理流程
        }
      }
    }
    
    // 预处理YAML内容，移除特殊标签
    content = preprocessYamlContent(content);
    
    // 特别检查: 如果内容是纯单行的Base64编码文本，尝试直接处理
    if (content.trim().split(/\r?\n/).length === 1 && content.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(content)) {
      try {
        console.log("检测到单行可能的Base64内容，尝试直接解码");
        const cleanContent = content.replace(/\s/g, '');
        const decodedContent = atob(cleanContent);
        
        // 如果解码后的内容包含节点URI特征，直接作为节点列表处理
        if (decodedContent.includes('ss://') || 
            decodedContent.includes('vmess://') || 
            decodedContent.includes('trojan://')) {
          
          console.log("解码后内容为节点列表，尝试直接解析");
          try {
            const nodeConfig = parseURIListToConfig(decodedContent);
            if (nodeConfig && nodeConfig.proxies && nodeConfig.proxies.length > 0) {
              const result = { config: nodeConfig };
              // 缓存成功的结果
              if (useCache) {
                setCachedData(cacheKey, result, cacheTTL);
              }
              return result;
            }
          } catch (nodeParseError) {
            console.warn("节点列表解析失败:", nodeParseError.message);
          }
        }
      } catch (err) {
        console.warn("单行Base64直接解码失败:", err.message);
        // 如果直接处理失败，继续使用标准流程
      }
    }
    
    // 检查内容是否为Base64编码
    const isBase64Content = isBase64(content);
    let originalContent = content;
    
    if (isBase64Content) {
      try {
        // 尝试解码Base64内容
        console.log("检测到Base64编码内容，尝试解码");
        const decodedContent = atob(content.replace(/\s/g, ''));
        content = decodedContent;
        
        // 解码后再次预处理
        content = preprocessYamlContent(content);
        
        // 检查解码后的内容是否仍然是Base64（有时订阅可能被多次编码）
        if (content.length > 20 && isBase64(content)) {
          try {
            console.log("检测到多重Base64编码，尝试二次解码");
            const secondDecodedContent = atob(content.replace(/\s/g, ''));
            content = preprocessYamlContent(secondDecodedContent);
          } catch (secondDecodeError) {
            console.warn("二次Base64解码失败", secondDecodeError);
            // 如果二次解码失败，保持使用第一次解码的结果
          }
        }
      } catch (decodeError) {
        console.warn("Base64解码失败", decodeError);
        // 如果解码失败，继续使用原始内容
        content = originalContent;
      }
    }
    
    // 使用日志记录内容的前100个字符，帮助调试
    console.log("解析内容前100个字符:", content.substring(0, 100));
    
    // 直接检查解码后的内容是否包含节点URI
    const hasNodeURIs = checkForNodeURIs(content);
    if (hasNodeURIs) {
      try {
        console.log("检测到节点URI列表，尝试解析");
        const nodeConfig = parseURIListToConfig(content);
        if (nodeConfig && nodeConfig.proxies && nodeConfig.proxies.length > 0) {
          const result = { config: nodeConfig };
          // 缓存成功的结果
          if (useCache) {
            setCachedData(cacheKey, result, cacheTTL);
          }
          return result;
        }
      } catch (nodeError) {
        console.warn("节点列表解析失败:", nodeError.message);
      }
    }
    
    // 修改解析策略: 优先尝试YAML解析，这是最常见的情况
    let config;
    let yamlError = null;
    
    // 1. 首先尝试解析为YAML (最常见情况)
    try {
      config = yaml.load(content);
      
      // 验证配置格式
      if (config && typeof config === 'object') {
        // 确认是否包含代理节点，或者至少是一个对象
        if (config.proxies && Array.isArray(config.proxies) && config.proxies.length > 0) {
          const result = { config };
          // 缓存成功的结果
          if (useCache) {
            setCachedData(cacheKey, result, cacheTTL);
          }
          return result;
        }
        
        // 如果仅缺少proxies字段但其他字段存在，可能是不完整的配置，我们可以添加空proxies
        if (Object.keys(config).length > 0) {
          config.proxies = config.proxies || [];
          const result = { config };
          // 缓存成功的结果 
          if (useCache) {
            setCachedData(cacheKey, result, cacheTTL);
          }
          return result;
        }
      }
    } catch (error) {
      yamlError = error;
      // YAML解析失败，继续下一步尝试
      console.warn("YAML解析失败:", error.message);
    }
    
    // 所有解析方法都失败，如果内容已被解码，尝试以原始内容再解析一次
    if (isBase64Content && originalContent !== content) {
      try {
        // 尝试解析原始内容
        console.log("原始内容再次尝试解析");
        const originalConfig = yaml.load(originalContent);
        if (originalConfig && typeof originalConfig === 'object') {
          if (originalConfig.proxies && Array.isArray(originalConfig.proxies) && originalConfig.proxies.length > 0) {
            const result = { config: originalConfig };
            // 缓存成功的结果
            if (useCache) {
              setCachedData(cacheKey, result, cacheTTL);
            }
            return result;
          }
          
          if (Object.keys(originalConfig).length > 0) {
            originalConfig.proxies = originalConfig.proxies || [];
            const result = { config: originalConfig };
            // 缓存成功的结果
            if (useCache) {
              setCachedData(cacheKey, result, cacheTTL);
            }
            return result;
          }
        }
      } catch (origError) {
        console.warn("原始内容解析尝试失败:", origError.message);
      }
    }
    
    // 所有解析方法都失败
    let errorResult;
    if (isBase64Content) {
      // 如果是Base64内容解析失败，提供更具体的错误
      errorResult = {
        error: `Base64内容解码后解析失败: ${yamlError ? yamlError.message : '无法识别的格式'}`
      };
    } else {
      errorResult = {
        error: yamlError 
          ? `YAML解析错误: ${yamlError.message}` 
          : "无效的配置格式或无法识别的节点格式"
      };
    }
    
    // 错误结果也缓存，但时间较短
    if (useCache) {
      setCachedData(cacheKey, errorResult, 300); // 错误结果缓存5分钟
    }
    
    return errorResult;
  } catch (e) {
    const errorResult = { error: e.message };
    
    // 错误结果也缓存，但时间较短
    if (useCache) {
      setCachedData(cacheKey, errorResult, 300); // 错误结果缓存5分钟
    }
    
    return errorResult;
  }
}

/**
 * 检查内容是否包含节点URI
 * @param {string} content 要检查的内容
 * @returns {boolean} 是否包含节点URI
 */
function checkForNodeURIs(content) {
  if (!content) return false;
  
  // 将内容分成行并过滤空行
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line);
  
  // 协议前缀列表
  const protocolPrefixes = ['vmess://', 'ss://', 'ssr://', 'trojan://', 'hysteria2://', 'vless://', 'http://', 'https://'];
  
  let validUriCount = 0;
  let totalLines = lines.length;
  
  // 检查是否有行以协议前缀开头
  for (const line of lines) {
    for (const prefix of protocolPrefixes) {
      // 更简单的检测：如果行以协议前缀开头且不是YAML文档的一部分，则认为是有效的URI
      if (line.startsWith(prefix)) {
        // 排除明显是YAML格式的行 
        if (!line.includes('name:') && 
            !line.includes('server:') && 
            !line.includes('port:') && 
            !line.includes('type:') &&
            !line.includes(': {') &&
            !line.includes('- {')) {
          validUriCount++;
          break;
        }
      }
    }
  }
  
  // 提高识别准确性：
  // 1. 如果有很多行，且有效URI占多数（>20%），明显是节点列表
  // 2. 如果行数少，只要有1个以上的有效URI，也可能是节点列表
  // 3. 如果只有一行但包含多个URI，可能是连续的URI列表
  const isMultilineNodeList = 
    (totalLines >= 5 && validUriCount / totalLines > 0.2) || 
    (totalLines < 5 && validUriCount > 0) ||
    (totalLines === 1 && content.includes('ss://') && content.length > 100);
  
  // 判断是否为单纯的节点URI列表（非YAML文档）
  const isNodeUriList = isMultilineNodeList && !content.includes('proxies:') && !content.includes('rules:');
  
  return isNodeUriList;
}

/**
 * 检查字符串是否为Base64编码
 * @param {string} str 要检查的字符串
 * @returns {boolean} 是否为Base64编码
 */
function isBase64(str) {
  if (!str || typeof str !== 'string') return false;
  
  // 清理内容 - 移除所有空白字符
  const cleanStr = str.replace(/\s/g, '');
  
  // 忽略过短的内容
  if (cleanStr.length < 20) return false;
  
  // 特殊检测: 单行长字符串且只包含Base64字符集，很可能是Base64编码的节点列表
  // (例如: https://raw.githubusercontent.com/aiboboxx/v2rayfree/main/v2)
  const isSingleLine = str.trim().split(/\r?\n/).length <= 3; // 允许最多3行（包括可能的空行）
  if (isSingleLine && cleanStr.length > 100) {
    const base64OnlyRegex = /^[A-Za-z0-9+/=]+$/;
    if (base64OnlyRegex.test(cleanStr)) {
      try {
        // 尝试解码一小部分
        const testDecode = atob(cleanStr.substring(0, Math.min(cleanStr.length, 1000)));
        // 检查解码内容是否包含节点URI特征
        if (testDecode.includes('ss://') || 
            testDecode.includes('vmess://') || 
            testDecode.includes('trojan://')) {
          // 高度可能是节点列表的Base64编码
          return true;
        }
      } catch (e) {
        // 解码测试失败，可能不是Base64
      }
    }
  }
  
  // 1. 标准格式检查: 只允许Base64字符集
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  if (!base64Regex.test(cleanStr)) {
    return false;
  }
  
  // 2. 长度验证: Base64编码的字符串长度应该是4的倍数(可能有填充)
  if (cleanStr.endsWith('=')) {
    // 如果有填充字符，移除填充后应该是4的倍数
    if (cleanStr.endsWith('==')) {
      if ((cleanStr.length - 2) % 4 !== 0) return false;
    } else {
      if ((cleanStr.length - 1) % 4 !== 0) return false;
    }
  } else if (cleanStr.length % 4 !== 0) {
    return false;
  }
  
  try {
    // 3. 尝试解码
    const decoded = atob(cleanStr);
    
    // 4. 判断是否为二进制数据
    const binaryTest = /[\x00-\x08\x0E-\x1F]/.test(decoded);
    if (binaryTest) {
      // 二进制数据不太可能是我们想要的配置文件
      return false;
    }
    
    // 5. 检查解码后是否包含YAML或节点特征
    // YAML特征
    if (decoded.includes('proxies:') || 
        decoded.includes('mixed-port:') || 
        decoded.includes('port:') ||
        decoded.includes('proxy-groups:') ||
        decoded.includes('rules:')) {
      return true;  // 这是Base64编码的YAML，应该解码
    }
    
    // 节点URI特征
    if (decoded.includes('vmess://') || 
        decoded.includes('ss://') || 
        decoded.includes('trojan://') ||
        decoded.includes('vless://') || 
        decoded.includes('hysteria2://')) {
      return true; // 这是Base64编码的节点列表，应该解码
    }
    
    // 6. 计算文本内容比例
    const textChars = decoded.split('').filter(c => {
      const code = c.charCodeAt(0);
      return code >= 32 && code <= 126; // ASCII可打印字符范围
    }).length;
    
    const textRatio = textChars / decoded.length;
    
    // 如果解码后文本比例高，并且内容中包含常见的配置关键词
    if (textRatio > 0.9) {
      if (decoded.includes('name:') && 
          (decoded.includes('server:') || decoded.includes('port:') || decoded.includes('type:'))) {
        return true; // 可能是配置文件
      }
      
      // 检查是否有多行内容，可能是代理列表
      const lines = decoded.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length > 2) {
        return true;
      }
    }
    
    // 默认情况下，如果不能确定，返回false
    return false;
  } catch (e) {
    // 解码失败，不是有效的Base64
    return false;
  }
}

/**
 * 解析节点URI列表并转换为Clash配置
 * @param {string} content URI列表文本
 * @returns {Object} Clash配置对象
 */
function parseURIListToConfig(content) {
  // 分割为行并过滤空行
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line);
  
  if (lines.length === 0) {
    return null;
  }
  
  // 处理所有类型的URI
  const proxies = [];
  let parseFailures = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 跳过注释行和空行
    if (line.startsWith('#') || line.length === 0) {
      continue;
    }
    
    // 对于非URI开头的行进行跳过
    if (!line.startsWith('ss://') && 
        !line.startsWith('ssr://') && 
        !line.startsWith('vmess://') && 
        !line.startsWith('trojan://') && 
        !line.startsWith('vless://') && 
        !line.startsWith('hysteria2://')) {
      continue;
    }
    
    const proxy = parseURI(line);
    
    if (proxy) {
      proxies.push(proxy);
    } else {
      parseFailures++;
      console.warn(`解析失败: 第${i+1}行: ${line.substring(0, 30)}...`);
    }
  }
  
  if (proxies.length === 0) {
    // 如果所有节点都解析失败，记录统计信息帮助调试
    console.warn(`节点解析统计: 总行数=${lines.length}, 解析失败数=${parseFailures}`);
    return null;
  }
  
  console.log(`成功解析节点: ${proxies.length}个, 失败: ${parseFailures}个`);
  
  // 创建默认配置
  return {
    port: 7890,
    'socks-port': 7891,
    'allow-lan': true,
    mode: 'rule',
    'log-level': 'info',
    proxies: proxies,
    'proxy-groups': [
      {
        name: '节点选择',
        type: 'select',
        proxies: ['DIRECT', ...proxies.map(p => p.name)]
      },
      {
        name: '自动选择',
        type: 'url-test',
        url: 'http://www.gstatic.com/generate_204',
        interval: 300,
        tolerance: 50,
        proxies: [...proxies.map(p => p.name)]
      }
    ],
    rules: [
      'MATCH,节点选择'
    ]
  };
}

/**
 * 解析单个节点URI
 * @param {string} uri 节点URI
 * @returns {Object|null} 解析后的节点对象，解析失败返回null
 */
function parseURI(uri) {
  try {
    // 提取URI中的注释部分作为名称
    let name = '';
    const hashIndex = uri.indexOf('#');
    if (hashIndex !== -1) {
      name = decodeURIComponent(uri.substring(hashIndex + 1));
      uri = uri.substring(0, hashIndex);
    }
    
    // 处理不同类型的URI
    if (uri.startsWith('hysteria2://')) {
      return parseHysteria2URI(uri, name);
    } else if (uri.startsWith('vmess://')) {
      return parseVmessURI(uri, name);
    } else if (uri.startsWith('ss://')) {
      return parseSsURI(uri, name);
    } else if (uri.startsWith('trojan://')) {
      return parseTrojanURI(uri, name);
    } else if (uri.startsWith('vless://')) {
      return parseVlessURI(uri, name);
    } else if (uri.startsWith('ssr://')) {
      return parseSsrURI(uri, name);
    }
    
    // 不支持的URI类型
    return null;
  } catch (error) {
    console.warn('URI解析错误:', error, uri);
    return null;
  }
}

/**
 * 解析Hysteria2节点URI
 * @param {string} uri Hysteria2 URI
 * @param {string} name 节点名称
 * @returns {Object} Hysteria2节点对象
 */
function parseHysteria2URI(uri, name) {
  try {
    // 移除协议前缀
    const content = uri.substring('hysteria2://'.length);
    
    // 分离用户信息和服务器信息
    const atIndex = content.indexOf('@');
    if (atIndex === -1) return null;
    
    const auth = content.substring(0, atIndex);
    const serverPart = content.substring(atIndex + 1);
    
    // 分离服务器地址和端口
    const colonIndex = serverPart.indexOf(':');
    if (colonIndex === -1) return null;
    
    const server = serverPart.substring(0, colonIndex);
    
    // 分离端口和参数
    let port = '';
    let params = {};
    
    const questionMarkIndex = serverPart.indexOf('?', colonIndex);
    if (questionMarkIndex === -1) {
      port = serverPart.substring(colonIndex + 1);
    } else {
      port = serverPart.substring(colonIndex + 1, questionMarkIndex);
      
      // 解析参数
      const paramsStr = serverPart.substring(questionMarkIndex + 1);
      paramsStr.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key && value !== undefined) {
          params[key] = decodeURIComponent(value);
        }
      });
    }
    
    // 创建节点对象 - 支持更多Hysteria2参数
    return {
      name: name || `Hysteria2_${server}_${port}`,
      type: 'hysteria2',
      server: server,
      port: parseInt(port),
      password: auth,
      sni: params.sni,
      skip_cert_verify: params.insecure === '1' || params.insecure === 'true',
      alpn: params.alpn ? params.alpn.split(',') : undefined,
      obfs: params.obfs,
      "obfs-password": params["obfs-password"],
      up: params.up,
      down: params.down,
      "hop-interval": params["hop-interval"] ? parseInt(params["hop-interval"]) : undefined,
      "fast-open": true,
      udp: true
    };
  } catch (error) {
    console.warn('Hysteria2 URI解析错误:', error);
    return null;
  }
}

/**
 * 解析VMess节点URI
 * @param {string} uri VMess URI
 * @param {string} name 节点名称
 * @returns {Object} VMess节点对象
 */
function parseVmessURI(uri, name) {
  // VMess URI格式: vmess://<base64>
  const base64Content = uri.substring('vmess://'.length);
  let config;
  
  try {
    config = JSON.parse(atob(base64Content));
  } catch (e) {
    return null;
  }
  
  return {
    name: name || config.ps || `VMess_${config.add}_${config.port}`,
    type: 'vmess',
    server: config.add,
    port: parseInt(config.port),
    uuid: config.id,
    alterId: parseInt(config.aid || '0'),
    cipher: config.scy || 'auto',
    tls: config.tls === 'tls',
    'skip-cert-verify': config.verify_cert === 'false',
    network: config.net || 'tcp',
    'ws-path': config.path,
    'ws-headers': config.host ? { Host: config.host } : undefined,
    servername: config.sni
  };
}

/**
 * 解析Shadowsocks节点URI
 * @param {string} uri Shadowsocks URI
 * @param {string} name 节点名称
 * @returns {Object} Shadowsocks节点对象
 */
function parseSsURI(uri, name) {
  // SS URI格式: ss://BASE64(method:password)@server:port
  const content = uri.substring('ss://'.length);
  
  // 检查是否是新格式 (Base64 + @server:port) 还是旧格式 (全部Base64)
  let method, password, server, port;
  
  if (content.includes('@')) {
    // 新格式
    const atIndex = content.indexOf('@');
    const auth = atob(content.substring(0, atIndex));
    const serverPart = content.substring(atIndex + 1);
    
    const colonIndex = auth.indexOf(':');
    if (colonIndex === -1) return null;
    
    method = auth.substring(0, colonIndex);
    password = auth.substring(colonIndex + 1);
    
    const serverColonIndex = serverPart.indexOf(':');
    if (serverColonIndex === -1) return null;
    
    server = serverPart.substring(0, serverColonIndex);
    port = serverPart.substring(serverColonIndex + 1);
  } else {
    // 旧格式，全部Base64编码
    try {
      const decodedContent = atob(content);
      const parts = decodedContent.split('@');
      if (parts.length !== 2) return null;
      
      const authParts = parts[0].split(':');
      if (authParts.length !== 2) return null;
      
      method = authParts[0];
      password = authParts[1];
      
      const serverParts = parts[1].split(':');
      if (serverParts.length !== 2) return null;
      
      server = serverParts[0];
      port = serverParts[1];
    } catch (e) {
      return null;
    }
  }
  
  // 创建节点对象
  return {
    name: name || `SS_${server}_${port}`,
    type: 'ss',
    server: server,
    port: parseInt(port),
    cipher: method,
    password: password
  };
}

/**
 * 解析Trojan节点URI
 * @param {string} uri Trojan URI
 * @param {string} name 节点名称
 * @returns {Object} Trojan节点对象
 */
function parseTrojanURI(uri, name) {
  // Trojan URI格式: trojan://password@server:port?sni=xxx
  const content = uri.substring('trojan://'.length);
  
  // 分离密码和服务器信息
  const atIndex = content.indexOf('@');
  if (atIndex === -1) return null;
  
  const password = content.substring(0, atIndex);
  const serverPart = content.substring(atIndex + 1);
  
  // 分离服务器地址和端口
  const colonIndex = serverPart.indexOf(':');
  if (colonIndex === -1) return null;
  
  const server = serverPart.substring(0, colonIndex);
  
  // 分离端口和参数
  let port = '';
  let params = {};
  
  const questionMarkIndex = serverPart.indexOf('?', colonIndex);
  if (questionMarkIndex === -1) {
    port = serverPart.substring(colonIndex + 1);
  } else {
    port = serverPart.substring(colonIndex + 1, questionMarkIndex);
    
    // 解析参数
    const paramsStr = serverPart.substring(questionMarkIndex + 1);
    paramsStr.split('&').forEach(param => {
      const [key, value] = param.split('=');
      params[key] = value;
    });
  }
  
  // 创建节点对象
  return {
    name: name || `Trojan_${server}_${port}`,
    type: 'trojan',
    server: server,
    port: parseInt(port),
    password: password,
    sni: params.sni,
    skip_cert_verify: params.allowInsecure === '1' || params.allowInsecure === 'true'
  };
}

/**
 * 解析VLESS节点URI
 * @param {string} uri VLESS URI
 * @param {string} name 节点名称
 * @returns {Object} VLESS节点对象
 */
function parseVlessURI(uri, name) {
  try {
    // VLESS URI格式: vless://uuid@server:port?param1=value1&param2=value2#name
    const content = uri.substring('vless://'.length);
    
    // 分离uuid和服务器信息
    const atIndex = content.indexOf('@');
    if (atIndex === -1) return null;
    
    const uuid = content.substring(0, atIndex);
    const serverPart = content.substring(atIndex + 1);
    
    // 分离服务器地址和端口
    const colonIndex = serverPart.indexOf(':');
    if (colonIndex === -1) return null;
    
    const server = serverPart.substring(0, colonIndex);
    
    // 分离端口和参数
    let port = '';
    let params = {};
    
    const questionMarkIndex = serverPart.indexOf('?', colonIndex);
    if (questionMarkIndex === -1) {
      port = serverPart.substring(colonIndex + 1);
    } else {
      port = serverPart.substring(colonIndex + 1, questionMarkIndex);
      
      // 解析参数
      const paramsStr = serverPart.substring(questionMarkIndex + 1);
      paramsStr.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key && value !== undefined) {
          params[key] = decodeURIComponent(value);
        }
      });
    }
    
    // 创建节点对象，兼容Clash Meta格式
    const vlessNode = {
      name: name || `VLESS_${server}_${port}`,
      type: 'vless',
      server: server,
      port: parseInt(port),
      uuid: uuid,
      flow: params.flow || '',
      udp: true,
      tls: params.security === 'tls' || params.security === 'reality',
      "skip-cert-verify": params.insecure === '1' || params.allowInsecure === 'true',
      servername: params.sni || params.servername,
      network: params.type || 'tcp',
      "reality-opts": params.security === 'reality' ? {
        "public-key": params.pbk || '',
        fingerprint: params.fp || '',
        "short-id": params.sid || '',
        "spider-x": params.spx || '/'
      } : undefined
    };
    
    // 添加适当的WS选项
    if (vlessNode.network === 'ws') {
      vlessNode["ws-opts"] = {
        path: params.path || '/',
        headers: params.host ? { Host: params.host } : undefined
      };
    }
    
    // 添加适当的HTTP选项
    if (vlessNode.network === 'http') {
      vlessNode["http-opts"] = {
        path: params.path ? [params.path] : ['/'],
        headers: params.host ? { Host: [params.host] } : undefined
      };
    }
    
    // 添加适当的GRPC选项
    if (vlessNode.network === 'grpc') {
      vlessNode["grpc-opts"] = {
        "grpc-service-name": params["grpc-service-name"] || params["serviceName"] || ''
      };
    }
    
    return vlessNode;
  } catch (error) {
    console.warn('VLESS URI解析错误:', error);
    return null;
  }
}

/**
 * 节点去重
 * 根据节点的关键属性（服务器、端口、类型等）去除重复节点
 */
function deduplicateProxies(proxies) {
  const uniqueProxies = [];
  const seen = new Set();
  
  for (const proxy of proxies) {
    // 创建一个唯一标识，包含节点的核心配置
    // 对于不同类型的节点，确保包含所有关键字段
    let uniqueKey;
    
    if (proxy.type === 'ss') {
      uniqueKey = `${proxy.type}:${proxy.server}:${proxy.port}:${proxy.cipher}`;
    } else if (proxy.type === 'ssr') {
      uniqueKey = `${proxy.type}:${proxy.server}:${proxy.port}:${proxy.cipher}:${proxy.protocol}:${proxy.obfs}`;
    } else if (proxy.type === 'vmess') {
      uniqueKey = `${proxy.type}:${proxy.server}:${proxy.port}:${proxy.uuid}:${proxy.alterId || 0}`;
    } else if (proxy.type === 'trojan') {
      uniqueKey = `${proxy.type}:${proxy.server}:${proxy.port}:${proxy.password}`;
    } else if (proxy.type === 'http' || proxy.type === 'https' || proxy.type === 'socks5' || proxy.type === 'socks5-tls') {
      uniqueKey = `${proxy.type}:${proxy.server}:${proxy.port}:${proxy.username || ''}:${proxy.password || ''}`;
    } else {
      // 对于未知类型的节点，使用JSON字符串作为唯一标识
      // 排除name字段，因为名称不同但配置相同的节点应被视为重复
      const { name, ...config } = proxy;
      uniqueKey = JSON.stringify(config);
    }
    
    if (!seen.has(uniqueKey)) {
      seen.add(uniqueKey);
      uniqueProxies.push(proxy);
    }
  }
  
  return uniqueProxies;
}

/**
 * 验证代理节点是否有效，修复可修复的问题，过滤掉无效的节点
 * @param {Array} proxies 代理节点数组
 * @returns {Array} 过滤后的有效节点数组
 */
function validateProxies(proxies) {
  if (!proxies || !Array.isArray(proxies)) {
    return [];
  }
  
  const validProxies = [];
  let invalidCount = 0;
  
  // 有效的SS加密方式列表
  const validSsCiphers = [
    'aes-128-gcm', 'aes-192-gcm', 'aes-256-gcm', 
    'aes-128-cfb', 'aes-192-cfb', 'aes-256-cfb', 
    'aes-128-ctr', 'aes-192-ctr', 'aes-256-ctr',
    'rc4-md5', 'chacha20', 'chacha20-ietf', 
    'chacha20-ietf-poly1305', 'xchacha20-ietf-poly1305'
  ];
  
  for (const proxy of proxies) {
    let isValid = true;
    let modified = false;
    const originalProxy = {...proxy};
    
    try {
      // 检查必要字段
      if (!proxy.name || !proxy.server || !proxy.type) {
        console.warn(`节点缺少必要字段: ${JSON.stringify(proxy)}`);
        isValid = false;
      } else {
        // 根据代理类型进行不同的验证
        switch (proxy.type) {
          case 'ss':
            // 检查并修复端口 - 必须是数字
            if (proxy.port) {
              // 处理端口字段包含插件信息的情况
              if (typeof proxy.port === 'string' && proxy.port.includes('?plugin=')) {
                const parts = proxy.port.split('?');
                const portNum = parseInt(parts[0], 10);
                
                if (!isNaN(portNum) && portNum > 0 && portNum < 65536) {
                  // 提取插件信息
                  const pluginInfo = parts[1];
                  
                  // 将端口设置为数字
                  proxy.port = portNum;
                  
                  // 添加插件信息
                  if (!proxy.plugin && pluginInfo.startsWith('plugin=')) {
                    // 替换%3B为;以正确解析插件参数
                    const decodedPluginInfo = pluginInfo.replace(/%3B/g, ';');
                    const pluginParts = decodedPluginInfo.split(';');
                    
                    if (pluginParts.length > 0) {
                      // 提取插件名称
                      const pluginName = pluginParts[0].replace('plugin=', '');
                      proxy.plugin = pluginName;
                      
                      // 提取插件选项
                      const pluginOpts = pluginParts.slice(1).join(';');
                      if (pluginOpts) {
                        proxy['plugin-opts'] = {};
                        
                        // 处理常见的插件选项
                        if (pluginName === 'v2ray-plugin' || pluginName === 'obfs') {
                          pluginParts.slice(1).forEach(part => {
                            if (part.includes('=')) {
                              const [key, value] = part.split('=');
                              proxy['plugin-opts'][key] = value;
                            } else if (part === 'tls') {
                              proxy['plugin-opts']['tls'] = true;
                            } else {
                              proxy['plugin-opts'][part] = true;
                            }
                          });
                        } else {
                          proxy['plugin-opts']['mode'] = pluginOpts;
                        }
                      }
                    }
                  }
                  
                  console.log(`修复了节点端口和插件信息: ${proxy.name}`);
                  modified = true;
                } else {
                  console.warn(`节点端口无效: ${proxy.name}, 端口: ${proxy.port}`);
                  isValid = false;
                }
              } else {
                // 正常端口处理
                const portNum = parseInt(proxy.port, 10);
                if (isNaN(portNum) || portNum <= 0 || portNum >= 65536) {
                  console.warn(`节点端口无效: ${proxy.name}, 端口: ${proxy.port}`);
                  isValid = false;
                } else if (portNum !== proxy.port) {
                  proxy.port = portNum; // 将字符串转换为数字
                  modified = true;
                }
              }
            } else {
              console.warn(`节点缺少端口: ${proxy.name}`);
              isValid = false;
            }
            
            // 检查并修复cipher - 必须是有效的加密方式
            if (!proxy.cipher) {
              console.warn(`节点缺少加密方式: ${proxy.name}`);
              isValid = false;
            } else if (proxy.cipher === 'ss') {
              // 尝试从密码中修复加密方式
              if (proxy.password && proxy.password.startsWith('//')) {
                try {
                  // 密码可能是Base64编码的"加密方式:密码"格式
                  const decodedPass = atob(proxy.password.substring(2));
                  if (decodedPass.includes(':')) {
                    const [cipher, password] = decodedPass.split(':');
                    if (validSsCiphers.includes(cipher)) {
                      proxy.cipher = cipher;
                      proxy.password = password;
                      console.log(`修复了节点加密方式: ${proxy.name}`);
                      modified = true;
                    } else {
                      console.warn(`无法识别的加密方式: ${cipher}, 节点: ${proxy.name}`);
                      isValid = false;
                    }
                  } else {
                    console.warn(`无法从密码解析加密方式: ${proxy.name}`);
                    isValid = false;
                  }
                } catch (e) {
                  console.warn(`解码密码失败: ${proxy.name}, 错误: ${e.message}`);
                  isValid = false;
                }
              } else {
                // 默认使用常见的加密方式
                proxy.cipher = 'aes-256-gcm';
                console.log(`为节点设置默认加密方式: ${proxy.name}`);
                modified = true;
              }
            } else if (!validSsCiphers.includes(proxy.cipher)) {
              console.warn(`节点使用了无效的加密方式: ${proxy.name}, 加密方式: ${proxy.cipher}`);
              isValid = false;
            }
            
            // 检查密码
            if (!proxy.password) {
              console.warn(`节点缺少密码: ${proxy.name}`);
              isValid = false;
            } else if (proxy.password.startsWith('//') && !modified) {
              // 如果密码以//开头但没有被修复，可能格式有问题
              console.warn(`节点密码格式异常: ${proxy.name}`);
              isValid = false;
            }
            
            // 检查并修复v2ray-plugin插件配置
            if (proxy.plugin === 'v2ray-plugin' && proxy['plugin-opts']) {
              const pluginOpts = proxy['plugin-opts'];
              const newPluginOpts = {};
              let needFix = false;
              
              // 检查是否存在URL编码的键
              for (const key in pluginOpts) {
                if (key.includes('%3D')) { // URL编码的等号
                  needFix = true;
                  
                  // 解析URL编码的键
                  const decodedParts = key.split('%3D');
                  if (decodedParts.length >= 2) {
                    const optKey = decodedParts[0];
                    const optValue = decodedParts[1];
                    
                    // 只保留我们关心的键
                    if (optKey === 'mode') {
                      newPluginOpts.mode = optValue;
                    } else if (optKey === 'mux') {
                      newPluginOpts.mux = parseInt(optValue, 10);
                    } else if (optKey === 'path') {
                      newPluginOpts.path = decodeURIComponent(optValue);
                    } else if (optKey === 'host') {
                      newPluginOpts.host = decodeURIComponent(optValue);
                    } else {
                      // 其他未知选项
                      newPluginOpts[optKey] = optValue;
                    }
                  }
                } else if (key === 'tls') {
                  // 保留tls设置
                  newPluginOpts.tls = pluginOpts[key];
                } else if (key === 'mode' || key === 'mux' || key === 'path' || key === 'host') {
                  // 保留已经正确的设置
                  newPluginOpts[key] = pluginOpts[key];
                }
              }
              
              // 如果需要修复，替换原始的plugin-opts
              if (needFix) {
                proxy['plugin-opts'] = newPluginOpts;
                
                // 确保有mode字段
                if (!newPluginOpts.mode) {
                  newPluginOpts.mode = 'websocket'; // 默认为websocket模式
                }
                
                console.log(`修复了v2ray-plugin配置: ${proxy.name}`);
                modified = true;
              } else {
                // 检查是否缺少mode字段
                if (!pluginOpts.mode) {
                  pluginOpts.mode = 'websocket'; // 默认为websocket模式
                  modified = true;
                }
              }
            }
            break;
            
          case 'vmess':
            // 检查端口
            if (proxy.port) {
              const portNum = parseInt(proxy.port, 10);
              if (isNaN(portNum) || portNum <= 0 || portNum >= 65536) {
                console.warn(`节点端口无效: ${proxy.name}, 端口: ${proxy.port}`);
                isValid = false;
              } else if (portNum !== proxy.port) {
                proxy.port = portNum; // 将字符串转换为数字
                modified = true;
              }
            } else {
              console.warn(`节点缺少端口: ${proxy.name}`);
              isValid = false;
            }
            
            // 检查UUID
            if (!proxy.uuid) {
              console.warn(`VMess节点缺少UUID: ${proxy.name}`);
              isValid = false;
            }
            
            // 检查并设置alterId
            if (proxy.alterId === undefined) {
              proxy.alterId = 0;
              modified = true;
            } else {
              const alterId = parseInt(proxy.alterId, 10);
              if (isNaN(alterId) || alterId < 0) {
                console.warn(`VMess节点alterId无效: ${proxy.name}, alterId: ${proxy.alterId}`);
                proxy.alterId = 0;
                modified = true;
              } else if (alterId !== proxy.alterId) {
                proxy.alterId = alterId;
                modified = true;
              }
            }
            break;
            
          case 'trojan':
            // 检查端口
            if (proxy.port) {
              const portNum = parseInt(proxy.port, 10);
              if (isNaN(portNum) || portNum <= 0 || portNum >= 65536) {
                console.warn(`节点端口无效: ${proxy.name}, 端口: ${proxy.port}`);
                isValid = false;
              } else if (portNum !== proxy.port) {
                proxy.port = portNum; // 将字符串转换为数字
                modified = true;
              }
            } else {
              console.warn(`节点缺少端口: ${proxy.name}`);
              isValid = false;
            }
            
            // 检查密码
            if (!proxy.password) {
              console.warn(`Trojan节点缺少密码: ${proxy.name}`);
              isValid = false;
            }
            break;
            
          case 'ssr':
            // 检查端口
            if (proxy.port) {
              const portNum = parseInt(proxy.port, 10);
              if (isNaN(portNum) || portNum <= 0 || portNum >= 65536) {
                console.warn(`节点端口无效: ${proxy.name}, 端口: ${proxy.port}`);
                isValid = false;
              } else if (portNum !== proxy.port) {
                proxy.port = portNum; // 将字符串转换为数字
                modified = true;
              }
            } else {
              console.warn(`节点缺少端口: ${proxy.name}`);
              isValid = false;
            }
            
            // 检查必要字段
            if (!proxy.cipher || !proxy.password || !proxy.protocol || !proxy.obfs) {
              console.warn(`SSR节点缺少必要字段: ${proxy.name}`);
              isValid = false;
            }
            break;
            
          case 'hysteria2':
            // 检查端口
            if (proxy.port) {
              const portNum = parseInt(proxy.port, 10);
              if (isNaN(portNum) || portNum <= 0 || portNum >= 65536) {
                console.warn(`节点端口无效: ${proxy.name}, 端口: ${proxy.port}`);
                isValid = false;
              } else if (portNum !== proxy.port) {
                proxy.port = portNum; // 将字符串转换为数字
                modified = true;
              }
            } else {
              console.warn(`节点缺少端口: ${proxy.name}`);
              isValid = false;
            }
            
            // 检查密码
            if (!proxy.password) {
              console.warn(`Hysteria2节点缺少密码: ${proxy.name}`);
              isValid = false;
            }
            break;
            
          default:
            // 对于其他协议，只检查端口
            if (proxy.port) {
              const portNum = parseInt(proxy.port, 10);
              if (isNaN(portNum) || portNum <= 0 || portNum >= 65536) {
                console.warn(`节点端口无效: ${proxy.name}, 端口: ${proxy.port}`);
                isValid = false;
              } else if (portNum !== proxy.port) {
                proxy.port = portNum; // 将字符串转换为数字
                modified = true;
              }
            }
        }
      }
      
      // 如果有效，添加到结果中
      if (isValid) {
        validProxies.push(proxy);
        if (modified) {
          console.log(`节点 "${proxy.name}" 已修复`);
        }
      } else {
        invalidCount++;
        console.warn(`丢弃无效节点: ${proxy.name || '未命名节点'}`);
      }
    } catch (error) {
      console.error(`验证节点时出错: ${error.message}, 节点: ${JSON.stringify(proxy)}`);
      invalidCount++;
    }
  }
  
  console.log(`节点验证结果: 共 ${proxies.length} 个节点, 有效 ${validProxies.length} 个, 无效 ${invalidCount} 个`);
  return validProxies;
}

/**
 * 国家/地区名称映射表
 * 每个中文名称对应其英文简称和全称（大小写不同形式）
 */
const regionMappings = {
  '香港': ['hk', 'HK', 'hongkong', 'Hongkong', 'HongKong', 'HONGKONG', 'hong kong', 'Hong Kong', 'HONG KONG'],
  '台湾': ['tw', 'TW', 'taiwan', 'Taiwan', 'TAIWAN', 'tai wan', 'Tai Wan', 'TAI WAN'],
  '日本': ['jp', 'JP', 'japan', 'Japan', 'JAPAN'],
  '韩国': ['kr', 'KR', 'korea', 'Korea', 'KOREA', 'south korea', 'South Korea', 'SOUTH KOREA'],
  '新加坡': ['sg', 'SG', 'singapore', 'Singapore', 'SINGAPORE'],
  '美国': ['us', 'US', 'usa', 'USA', 'united states', 'United States', 'UNITED STATES', 'america', 'America', 'AMERICA'],
  '英国': ['uk', 'UK', 'united kingdom', 'United Kingdom', 'UNITED KINGDOM', 'britain', 'Britain', 'BRITAIN'],
  '德国': ['de', 'DE', 'germany', 'Germany', 'GERMANY'],
  '法国': ['fr', 'FR', 'france', 'France', 'FRANCE'],
  '印度': ['in', 'IN', 'india', 'India', 'INDIA'],
  '澳大利亚': ['au', 'AU', 'australia', 'Australia', 'AUSTRALIA'],
  '加拿大': ['ca', 'CA', 'canada', 'Canada', 'CANADA'],
  '俄罗斯': ['ru', 'RU', 'russia', 'Russia', 'RUSSIA'],
  '巴西': ['br', 'BR', 'brazil', 'Brazil', 'BRAZIL'],
  '意大利': ['it', 'IT', 'italy', 'Italy', 'ITALY'],
  '荷兰': ['nl', 'NL', 'netherlands', 'Netherlands', 'NETHERLANDS'],
  '土耳其': ['tr', 'TR', 'turkey', 'Turkey', 'TURKEY'],
  '泰国': ['th', 'TH', 'thailand', 'Thailand', 'THAILAND'],
  '越南': ['vn', 'VN', 'vietnam', 'Vietnam', 'VIETNAM'],
  '马来西亚': ['my', 'MY', 'malaysia', 'Malaysia', 'MALAYSIA'],
  '菲律宾': ['ph', 'PH', 'philippines', 'Philippines', 'PHILIPPINES'],
  '印度尼西亚': ['id', 'ID', 'indonesia', 'Indonesia', 'INDONESIA'],
  '阿根廷': ['ar', 'AR', 'argentina', 'Argentina', 'ARGENTINA'],
  '瑞士': ['ch', 'CH', 'switzerland', 'Switzerland', 'SWITZERLAND'],
  '瑞典': ['se', 'SE', 'sweden', 'Sweden', 'SWEDEN'],
  '挪威': ['no', 'NO', 'norway', 'Norway', 'NORWAY'],
  '芬兰': ['fi', 'FI', 'finland', 'Finland', 'FINLAND'],
  '爱尔兰': ['ie', 'IE', 'ireland', 'Ireland', 'IRELAND'],
  '波兰': ['pl', 'PL', 'poland', 'Poland', 'POLAND'],
  '南非': ['za', 'ZA', 'south africa', 'South Africa', 'SOUTH AFRICA'],
  '墨西哥': ['mx', 'MX', 'mexico', 'Mexico', 'MEXICO'],
  '西班牙': ['es', 'ES', 'spain', 'Spain', 'SPAIN'],
  '葡萄牙': ['pt', 'PT', 'portugal', 'Portugal', 'PORTUGAL'],
  '比利时': ['be', 'BE', 'belgium', 'Belgium', 'BELGIUM'],
  '奥地利': ['at', 'AT', 'austria', 'Austria', 'AUSTRIA']
};

/**
 * 扩展区域名称过滤条件
 * @param {string} nameFilter 原始过滤条件
 * @returns {string} 扩展后的过滤条件
 */
function expandRegionNameFilter(nameFilter) {
  if (!nameFilter) return nameFilter;
  
  // 检查原始过滤条件是否包含任何映射表中的区域名称
  for (const [region, alternatives] of Object.entries(regionMappings)) {
    // 如果过滤条件精确匹配某个区域名称，则扩展为包含所有可能的形式
    if (nameFilter === region || alternatives.includes(nameFilter)) {
      // 构建一个包含所有可能形式的正则表达式
      const allForms = [region, ...alternatives];
      return `(${allForms.join('|')})`;
    }
    
    // 如果过滤条件中包含区域名称，尝试替换为更全面的形式
    if (nameFilter.includes(region)) {
      // 注意：这里我们只是简单替换，可能会导致一些边缘情况的问题
      // 如果需要更精确的替换，可能需要使用正则表达式并检查单词边界
      const regionPattern = new RegExp(region, 'g');
      const replacement = `(${region}|${alternatives.join('|')})`;
      nameFilter = nameFilter.replace(regionPattern, replacement);
    }
    
    // 检查是否包含任何替代形式
    for (const alt of alternatives) {
      if (nameFilter.includes(alt)) {
        // 在过滤条件中找到了替代形式，替换为完整的可选表达式
        const altPattern = new RegExp(alt, 'g');
        const altReplacement = `(${region}|${alternatives.join('|')})`;
        nameFilter = nameFilter.replace(altPattern, altReplacement);
        // 已经进行了替换，跳出内部循环以避免重复替换
        break;
      }
    }
  }
  
  return nameFilter;
}

/**
 * 结合两个过滤器
 * 如果两个过滤器都存在，则创建一个匹配两者的正则表达式
 */
function combineFilters(userFilter, forceFilter) {
  if (!userFilter && !forceFilter) return null;
  if (!userFilter) return forceFilter;
  if (!forceFilter) return userFilter;
  
  // 两个过滤器都存在，创建匹配两者的正则表达式
  return `(?=${userFilter})(?=${forceFilter})`;
}

/**
 * 判断字符串是否为IP地址
 * @param {string} str 要检查的字符串
 * @returns {boolean} 是否为IP地址
 */
function isIPAddress(str) {
  if (!str) return false;
  
  // IPv4地址格式检查
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = str.match(ipv4Pattern);
  
  if (!match) return false;
  
  // 验证每个部分是否在0-255范围内
  for (let i = 1; i <= 4; i++) {
    const part = parseInt(match[i]);
    if (part < 0 || part > 255) {
      return false;
    }
  }
  
  return true;
}

/**
 * 判断字符串是否为域名
 * @param {string} str 要检查的字符串
 * @returns {boolean} 是否为域名
 */
function isDomainName(str) {
  if (!str) return false;
  
  // 如果是IP，则不是域名
  if (isIPAddress(str)) return false;
  
  // 以下是一些常见的非域名服务器地址
  if (str === 'localhost' || str.startsWith('127.') || str === '0.0.0.0') {
    return false;
  }
  
  // 多级检查 - 先用宽松规则，再用严格规则
  
  // 1. 基本检查: 域名需要至少包含一个点，并且没有空格和特殊字符
  if (!str.includes('.') || /\s/.test(str)) {
    return false;
  }
  
  // 2. 宽松检查: 域名格式检查(包括国际化域名支持)
  // 这个正则表达式比较宽松，允许大多数合法域名格式
  const looseDomainPattern = /^([a-zA-Z0-9_]([a-zA-Z0-9\-_]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9\-]{1,}$/;
  
  // 3. 特殊情况: 某些特殊的二级域名格式可能不符合严格规则
  // 例如: 以数字结尾的域名 (example.123)、非标准顶级域名等
  // 如果域名长度适中且至少包含一个点，而且不含空格或奇怪字符，很可能是域名
  const isPotentialDomain = str.length > 3 && str.length < 255 && 
                          str.includes('.') && 
                          !/[\s,!@#$%^&*()+={}\[\]:;"'<>?\/\\|]/.test(str);
  
  // 返回检查结果: 如果通过宽松规则，或者看起来很像域名，则认为是域名
  return looseDomainPattern.test(str) || isPotentialDomain;
}

/**
 * 过滤代理节点
 */
function filterProxies(proxies, nameFilter, typeFilter, serverFilter) {
  // 如果有名称过滤条件，首先扩展它以包含区域名称的各种形式
  const expandedNameFilter = nameFilter ? expandRegionNameFilter(nameFilter) : null;
  
  return proxies.filter(proxy => {
    let nameMatch = true;
    let typeMatch = true;
    let serverMatch = true;

    if (expandedNameFilter && proxy.name) {
      try {
        const nameRegex = new RegExp(expandedNameFilter);
        nameMatch = nameRegex.test(proxy.name);
      } catch (error) {
        console.warn('Invalid name regex:', error);
        nameMatch = true;
      }
    }

    if (typeFilter && proxy.type) {
      try {
        const typeRegex = new RegExp(typeFilter);
        typeMatch = typeRegex.test(proxy.type);
      } catch (error) {
        console.warn('Invalid type regex:', error);
        typeMatch = true;
      }
    }

    if (serverFilter && proxy.server) {
      // 特殊处理'domain'和'ip'关键词
      if (serverFilter === 'domain') {
        serverMatch = isDomainName(proxy.server);
      } else if (serverFilter === 'ip') {
        serverMatch = isIPAddress(proxy.server);
      } else {
        try {
          // 对于其他值，使用正则表达式匹配
          const serverRegex = new RegExp(serverFilter);
          serverMatch = serverRegex.test(proxy.server);
        } catch (error) {
          console.warn('Invalid server regex:', error);
          serverMatch = true;
        }
      }
    }

    return nameMatch && typeMatch && serverMatch;
  });
}

/**
 * 重命名代理节点
 * 如果提供了固定前缀，则使用该前缀统一命名所有节点
 * 否则，按原规则：用"_"分割原始名称并取第一个
 * @param {Array} proxies 要重命名的代理节点数组
 * @param {string} nameFilter 名称过滤条件，可能包含多个区域条件
 * @returns {Array} 重命名后的节点数组
 */
function renameProxies(proxies, nameFilter) {
  // 无论是否有过滤条件，都尝试识别节点的区域并进行分组
  // 1. 根据节点名自动识别区域
  const proxyWithRegion = proxies.map(proxy => {
    const nodeName = proxy.name || '';
    let region = '';
    
    // 尝试从节点名中识别区域
    for (const [regionName, alternatives] of Object.entries(regionMappings)) {
      if (nodeName.toLowerCase().includes(regionName.toLowerCase())) {
        region = regionName;
        break;
      }
      
      // 检查备选形式
      const found = alternatives.some(alt => 
        nodeName.toLowerCase().includes(alt.toLowerCase())
      );
      
      if (found) {
        region = regionName;
        break;
      }
    }
    
    // 如果识别不到区域，提取名称前缀或使用默认值
    if (!region) {
      // 尝试从服务器地址判断区域（对特定IP段）
      if (proxy.server) {
        region = guessRegionFromServer(proxy.server);
      }
      
      // 如果仍然无法判断，提取名称前缀或使用默认值
      if (!region) {
        const parts = nodeName.split(/[\s_\-+|:：]/);
        region = parts[0] || "节点";
      }
    }
    
    return { ...proxy, region };
  });
  
  // 2. 按区域分组并计数
  const regionCounts = {};
  
  // 如果有过滤条件，使用条件中的区域，否则使用自动识别的区域
  if (nameFilter) {
    // 已有过滤条件的处理逻辑 - 解析过滤条件中的区域
    const regionConditions = parseRegionConditions(nameFilter);
    
    return proxyWithRegion.map(proxy => {
      // 确定节点匹配的区域
      const matchedRegion = determineMatchedRegion(proxy.name, regionConditions);
      
      // 更新该区域的计数
      regionCounts[matchedRegion] = (regionCounts[matchedRegion] || 0) + 1;
      
      // 创建新名称，使用匹配的区域名称
      const newName = `${matchedRegion}_${regionCounts[matchedRegion]}`;
      
      // 返回带有新名称的代理节点
      return {
        ...proxy,
        name: newName
      };
    });
  } else {
    // 没有过滤条件时的改进处理逻辑
    // 排序顺序: 1. 按区域分组 2. 同一区域内可选按类型次要排序
    proxyWithRegion.sort((a, b) => {
      if (a.region !== b.region) {
        return a.region.localeCompare(b.region);
      }
      // 次要排序: 按类型
      return (a.type || '').localeCompare(b.type || '');
    });
    
    // 按区域重命名
    return proxyWithRegion.map(proxy => {
      // 更新该区域的计数
      regionCounts[proxy.region] = (regionCounts[proxy.region] || 0) + 1;
      
      // 规范化区域名称 - 使用中文区域名称或原始区域标识
      const displayRegion = proxy.region;
      
      // 创建新名称
      const newName = `${displayRegion}_${regionCounts[proxy.region]}`;
      
      // 返回带有新名称的代理节点
      return {
        ...proxy,
        name: newName
      };
    });
  }
}

/**
 * 根据服务器IP地址猜测区域
 * @param {string} server 服务器地址
 * @returns {string} 猜测的区域名称，无法判断时返回空字符串
 */
function guessRegionFromServer(server) {
  // 简单的IP判断逻辑
  // 注意: 这只是一个基础实现，实际IP地理位置需要更完整的数据库
  
  // 检查是否为IP地址 (简单判断)
  const isIP = isIPAddress(server);
  if (!isIP) {
    // 判断域名后缀
    if (server.endsWith('.jp') || server.includes('japan') || server.includes('jp')) {
      return '日本';
    } else if (server.endsWith('.hk') || server.includes('hongkong') || server.includes('hk')) {
      return '香港';
    } else if (server.endsWith('.sg') || server.includes('singapore') || server.includes('sg')) {
      return '新加坡';
    } else if (server.endsWith('.tw') || server.includes('taiwan') || server.includes('tw')) {
      return '台湾';
    } else if (server.endsWith('.us') || server.includes('america') || server.includes('us')) {
      return '美国';
    } else if (server.endsWith('.kr') || server.includes('korea') || server.includes('kr')) {
      return '韩国';
    } else if (server.endsWith('.uk') || server.includes('united.kingdom')) {
      return '英国';
    } else if (server.endsWith('.de') || server.includes('germany')) {
      return '德国';
    } else if (server.endsWith('.fr') || server.includes('france')) {
      return '法国';
    } else if (server.endsWith('.ca') || server.includes('canada')) {
      return '加拿大';
    }
    
    return '';
  }
  
  // 将IP转换为数字数组
  const ipParts = server.split('.').map(part => parseInt(part, 10));
  
  // 检查一些已知的IP范围
  // 这只是示例，实际应使用完整的IP地理位置数据库
  if (ipParts[0] === 13 || ipParts[0] === 14) {
    return '美国'; // 示例: 13.x.x.x 和 14.x.x.x 可能是美国IP
  } else if (ipParts[0] === 103 && ipParts[1] >= 100 && ipParts[1] <= 110) {
    return '新加坡'; // 示例: 103.10x.x.x 可能是新加坡IP
  } else if (ipParts[0] === 101 && ipParts[1] >= 32 && ipParts[1] <= 36) {
    return '日本'; // 示例: 101.3x.x.x 可能是日本IP
  } else if ((ipParts[0] === 219 || ipParts[0] === 220) && ipParts[1] >= 68 && ipParts[1] <= 88) {
    return '香港'; // 示例: 219.7x.x.x 可能是香港IP
  } else if (ipParts[0] === 182 && ipParts[1] >= 230 && ipParts[1] <= 250) {
    return '台湾'; // 示例: 182.24x.x.x 可能是台湾IP
  }
  
  return '';
}

/**
 * 解析过滤条件中包含的区域名称
 * @param {string} nameFilter 名称过滤条件
 * @returns {Array} 包含区域名称和备选形式的数组
 */
function parseRegionConditions(nameFilter) {
  if (!nameFilter) return [];
  
  // 尝试提取过滤条件中的区域名称
  const conditions = [];
  
  // 首先检查是否是简单的或条件，如 "jp|sg|kr|台湾"
  const orParts = nameFilter.split('|');
  if (orParts.length > 1) {
    for (const part of orParts) {
      const trimmedPart = part.trim();
      // 检查是否是已知的区域名称或其备选形式
      const matchedRegion = getRegionByNameOrAlternative(trimmedPart);
      if (matchedRegion) {
        conditions.push(matchedRegion);
      } else {
        conditions.push({
          name: trimmedPart,
          alternatives: []
        });
      }
    }
  } else {
    // 如果不是简单的或条件，尝试其他模式，如 "(香港|日本)"
    const bracketsMatch = nameFilter.match(/\((.*?)\)/);
    if (bracketsMatch && bracketsMatch[1]) {
      const innerParts = bracketsMatch[1].split('|');
      for (const part of innerParts) {
        const trimmedPart = part.trim();
        const matchedRegion = getRegionByNameOrAlternative(trimmedPart);
        if (matchedRegion) {
          conditions.push(matchedRegion);
        } else {
          conditions.push({
            name: trimmedPart,
            alternatives: []
          });
        }
      }
    } else {
      // 如果是单一条件，直接检查
      const matchedRegion = getRegionByNameOrAlternative(nameFilter.trim());
      if (matchedRegion) {
        conditions.push(matchedRegion);
      } else {
        conditions.push({
          name: nameFilter.trim(),
          alternatives: []
        });
      }
    }
  }
  
  return conditions;
}

/**
 * 根据名称或备选形式获取区域信息
 * @param {string} nameOrAlt 区域名称或备选形式
 * @returns {Object|null} 包含区域名称和备选形式的对象，未找到返回null
 */
function getRegionByNameOrAlternative(nameOrAlt) {
  // 检查是否完全匹配某个区域名称
  if (regionMappings[nameOrAlt]) {
    return {
      name: nameOrAlt,
      alternatives: regionMappings[nameOrAlt]
    };
  }
  
  // 检查是否匹配某个区域的备选形式
  for (const [region, alternatives] of Object.entries(regionMappings)) {
    if (alternatives.includes(nameOrAlt)) {
      return {
        name: region,
        alternatives: alternatives
      };
    }
  }
  
  return null;
}

/**
 * 确定节点名称匹配的区域
 * @param {string} nodeName 节点名称
 * @param {Array} regionConditions 区域条件数组
 * @returns {string} 匹配的区域名称，未匹配到返回"node"
 */
function determineMatchedRegion(nodeName, regionConditions) {
  if (!nodeName || !regionConditions || regionConditions.length === 0) {
    return "node";
  }
  
  // 检查节点名称是否匹配任何区域名称或其备选形式
  for (const region of regionConditions) {
    // 首先检查区域名称
    if (nodeName.toLowerCase().includes(region.name.toLowerCase())) {
      return region.name;
    }
    
    // 然后检查备选形式
    for (const alt of region.alternatives) {
      if (nodeName.toLowerCase().includes(alt.toLowerCase())) {
        return region.name;  // 返回中文区域名称
      }
    }
  }
  
  // 未匹配到任何区域，使用第一个条件的名称，或默认值"node"
  return regionConditions.length > 0 ? regionConditions[0].name : "node";
}

/**
 * 更新代理组
 * @param {Array} proxyGroups 原始代理组配置
 * @param {Array} validProxyNames 筛选后的有效节点名称列表
 * @returns {Array} 更新后的代理组配置
 */
function updateProxyGroups(proxyGroups, validProxyNames) {
  if (!proxyGroups || !Array.isArray(proxyGroups) || proxyGroups.length === 0) {
    return proxyGroups;
  }
  
  // 确保我们有节点可用
  if (!validProxyNames || validProxyNames.length === 0) {
    // 如果没有有效节点，至少保留DIRECT
    return proxyGroups.map(group => ({
      ...group,
      proxies: ['DIRECT']
    }));
  }

  // 特殊处理不同类型的代理组
  return proxyGroups.map(group => {
    if (!group.proxies || !Array.isArray(group.proxies)) {
      // 如果代理组没有proxies字段或不是数组，添加一个默认的
      return {
        ...group,
        proxies: ['DIRECT', ...validProxyNames]
      };
    }
    
    // 保留特殊节点和其他代理组引用
    const specialNodes = group.proxies.filter(name => 
      name === 'DIRECT' || name === 'REJECT' || name === 'GLOBAL' ||
      proxyGroups.some(g => g.name === name)
    );
    
    // 根据不同的代理组类型处理
    if (group.type === 'select') {
      // 选择类型应该包含所有节点
      return {
        ...group,
        proxies: [...specialNodes, ...validProxyNames]
      };
    } else if (['url-test', 'fallback', 'load-balance'].includes(group.type)) {
      // 自动测试类型通常包含所有节点但不包含DIRECT/REJECT
      return {
        ...group,
        proxies: validProxyNames.length > 0 ? validProxyNames : ['DIRECT']
      };
    } else {
      // 其他类型的代理组，只保留有效的节点
      const validProxies = group.proxies.filter(name => 
        validProxyNames.includes(name) || 
        specialNodes.includes(name)
      );
      
      // 确保至少有一个节点
      return {
        ...group,
        proxies: validProxies.length > 0 ? validProxies : ['DIRECT']
      };
    }
  });
}

/**
 * 预处理YAML内容，处理特殊标签和格式
 * @param {string} content 原始YAML内容
 * @returns {string} 预处理后的YAML内容
 */
function preprocessYamlContent(content) {
  if (!content) return content;
  
  // 检查内容是否包含HTML标签，如果包含，可能是一个HTML页面而不是YAML
  if (content.includes('<html') || content.includes('<!DOCTYPE') || 
      content.includes('<head') || content.includes('<body') || 
      content.includes('</div>') || content.includes('style=')) {
    console.warn("检测到内容可能包含HTML标签，尝试提取YAML部分");
    
    // 尝试从HTML中提取可能的YAML内容
    // 检查是否有<pre>标签包裹的内容，这通常是代码块
    const preMatch = content.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (preMatch && preMatch[1]) {
      console.log("从<pre>标签中提取内容");
      content = preMatch[1];
    } else {
      // 如果没有<pre>标签，尝试查找第一个看起来像YAML的行
      const lines = content.split(/\r?\n/);
      let yamlStartIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        // 查找可能的YAML起始行 (例如: mixed-port: 7890)
        if (lines[i].match(/^\s*[a-zA-Z0-9_-]+\s*:\s*.+$/)) {
          yamlStartIndex = i;
          break;
        }
      }
      
      if (yamlStartIndex >= 0) {
        console.log(`从第${yamlStartIndex + 1}行开始提取YAML内容`);
        content = lines.slice(yamlStartIndex).join('\n');
      } else {
        // 如果找不到YAML起始行，返回一个空的有效YAML
        console.warn("无法从内容中提取YAML，返回空配置");
        return "proxies: []";
      }
    }
    
    // 进一步清理提取的内容
    content = content.replace(/<[^>]*>/g, ''); // 移除所有剩余的HTML标签
    content = content.replace(/&[a-z]+;/g, ' '); // 替换HTML实体为空格
  }
  
  // 特殊处理已知的问题URL
  // 检查是否包含"white-space: pre-wrap"这种样式标记
  if (content.includes('white-space: pre-wrap') || content.includes('word-wrap: break-word')) {
    console.warn("检测到样式标记，尝试移除");
    // 移除所有样式相关的内容
    content = content.replace(/style="[^"]*"/g, '');
    content = content.replace(/class="[^"]*"/g, '');
    content = content.replace(/word-wrap:[^;]*;/g, '');
    content = content.replace(/white-space:[^;]*;/g, '');
    
    // 移除所有HTML标签
    content = content.replace(/<[^>]*>/g, '');
  }
  
  // 移除特殊的YAML标签，如 !<str>
  content = content.replace(/!<str>\s+/g, '');
  content = content.replace(/!\s+/g, '');  // 处理简单的 ! 标签
  content = content.replace(/!<[^>]+>\s+/g, ''); // 处理所有 !<xxx> 格式标签
  
  // 处理其他可能导致解析问题的特殊格式
  // 处理转义引号
  content = content.replace(/\\"/g, '"');
  
  // 处理可能有问题的缩进 - 转换所有非标准空白为标准空格
  content = content.replace(/\t/g, '  '); // 制表符替换为两个空格
  
  // 处理非法的UTF字符
  content = content.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  
  return content;
}
