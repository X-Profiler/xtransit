export as namespace xtransit;

export interface XtransitConfig {
  // I. 必须的配置（一定要写）
  server: string, // 填写前一节中部署的 xtransit-server 地址 如：`ws://127.0.0.1:9090`
  appId: number, // 创建应用得到的应用 ID
  appSecret: string, // 创建应用得到的应用 Secret

  // II. 比较重要的可选配置（不知道怎么配置的别传任何值，key 也别传，整个配置留空！！）
  disks?: string[], // 数组，每一项为配置需要监控的 disk 目录全路径
  errors?: string[], // 数组，每一项为配置需要监控的 error 日志文件全路径
  packages?: string[], // 数组，每一项为配置需要监控的 package.json 文件全路径，并且要保证存在平级的 lock 文件（package-lock.json 或者 yarn.lock）

  // III. 不是很重要的可选的配置（不知道怎么配置的别传任何值，key 也别传，整个配置留空！！）
  logDir?: string, // xprofiler 插件生成性能日志文件的目录，默认两者均为 os.tmpdir() 如：'/path/to/xprofiler_output'
  docker?: boolean, // 默认 false，系统数据采集会依赖当前是否是 docker 环境而进行一些特殊处理，可以手动强制指定当前实例是否为 docker 环境
  ipMode?: boolean, // 默认 false，此时仅使用 hostname 作为 agentId；设置为 true 后 agentId 组装形式为 ${ip}_${hostname} 
  libMode?: boolean, // 默认 false，此时采集如果收到 shutdown 事件会退出当前进程；如果是以第三方库的形式引用接入应用内，请将此属性设置为 true
  errexp?: RegExp, // 匹配错误日志起始的正则，默认为匹配到 YYYY-MM-DD HH:mm:ss 时间戳即认为是一条错误日志的起始 /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/i
  logger?: string, // 可以传入应用日志句柄方便日志统一管理，注意需要实现 error, info, warn 和 debug 四个方法
  logLevel?: number, // 默认内置 logger 的日志级别，0 error，1 info，2 warning，3 debug,
  titles?: string[], // 数组，如果应用使用了 process.title 自定义了名称，可以通过配置这里上报进程数据,
  cleanAfterUpload?: boolean, // 默认 false，如果设置为 true 则会在转储本地性能文件成功后删除本地的性能文件
  customAgent?: () => string | undefined, // 默认 undefined，如果设置则会使用此函数计算 agentId
}

/**
 * Start xtransit.
 * @example
 * // set your own log dir
 * xprofiler.start({log_dir: '/path/to/your/logdir'});
 * @param config xtransit config.
 */
export function start(config: XtransitConfig): void;
