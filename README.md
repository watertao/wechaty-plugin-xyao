# wechaty-plugin-xyao

[![Powered by Wechaty](https://img.shields.io/badge/Powered%20By-Wechaty-green.svg)](https://github.com/chatie/wechaty)
[![Wechaty开源激励计划](https://img.shields.io/badge/Wechaty-开源激励计划-green.svg)](https://github.com/juzibot/Welcome/wiki/Everything-about-Wechaty)

wechaty-plugin-xyao 插件可以让你的 wechaty bot 具备以分布式模块执行自定义指令的能力。

![sample](docs/images/interaction-sample.png)

bot 将 `fin:` 前缀的指令通过队列交给 fin 相关的模块处理，而 `x:`前缀的指令则通过队列交给 x 对应的处理模块。而对于哪些无法被识别
为指令的消息，会统一交给某个处理模块（通常是一个具备智能闲聊能力的处理模块，比如 百度 unit）。


这些处理模块被称之为 `brain 模块`，它相当于为 bot 赋予了某一个部分领域知识的副脑。


## Requirements

1. Node.js v12+
1. Wechaty v0.40+
1. This Plugin
1. Redis server
1. one or more brain service

## Usage

```ts
import { Wechaty } from 'wechaty';
import { PuppetPadplus } from 'wechaty-puppet-padplus';
import { Xyao } from '../src/mod';


const token = 'your PAD-PLUS token';
const puppet = new PuppetPadplus({ token });

const bot = new Wechaty({
  puppet,
  name : 'x.yao',
})

const xyaoConfig = {
  redis_host: 'localhost',
  redis_port: 6379,
  redis_password: '123456',
  redis_retry_interval: 5000,
  masters: ['wxid_of_master'],
  brains_cli: ['x', 'jira'],
  brains_ai: 'ai918',
  log_appender: 'dateFile',
  log_file: '/data/wechaty-xyao/xyao.log',
  log_level: 'INFO'
};


bot.use(
    Xyao(xyaoConfig),
)

bot.start()
    .catch(console.error)
```

### 1 配置插件

1. `redis_host`: redis ip
1. `redis_port`: redis 端口
1. `redis_password`: redis 密码
1. `redis_retry_interval`: redis 断线重连间隔
1. `masters`: 机器人的主人账号(注意是contact.id)，有部分指令必须是主人发起的才会执行
1. `brains_cli`: brain 列表
1. `brains_ai`: 未被识别为指令的的消息会交给这个 brain 模块
1. `log_appender`: `dateFile` 输出到指定文件，按日期分割； `stdout` 输出到控制台
1. `log_file`: 日志文件路径
1. `log_level`: 日志级别



## why wechaty-plugin-xyao

使用这个插件，至少会带来以下几个优势：
1. 如果机器人的业务处理和微信通讯部分都集中在单个进程，随着业务逻辑数量的增长，处理性能会遇到瓶颈，且一部分逻辑出现问题可能导致整个 bot crash，而解耦通讯与业务，并独立部署不同业务，能够有效缓解
这个问题。
2. 独立出的业务处理模块( `brain 模块` )可以采用任意适合该领域业务的语言（目前提供了一个基于 java springboot 的 brain 模块开发框架）。
3. 由于采用了基于 pub/sub 的消息中间件作为机器人和 brain 的通讯，因此即使两者之间由于 NAT 无法提供基于固定公网 IP 的 RPC 服务，也可以通过这种方式
打通交互。



## 部署架构参考

![architecture](docs/images/arc.png)

bot 在收到消息后，先尝试识别指令，识别为指令后，按前缀通过队列分发给指定的 brain 模块去处理。


每个 brain 模块都有自己唯一的标识，该标识会作为指令的前缀，比如 `fin:index` 指令会交给标识为 `fin` 的 brain 模块。


## 指令

指令是一条带有规定格式的微信消息。

比如跟机器人私聊或者在群内 @ 机器人，跟它说：

```
jira:bind-project -p READK223
```
那么这条消息将被机器人识别为指令，
 - `jira` 是 brain 模块标识，机器人根据此标识将指令传递给相应的 brain 处理模块
 - `bind-project` 是指令关键字，brain 模块根据此关键字决定采用哪段业务处理逻辑
 - `-p READK223` 是指令的选项，通常一个指令会有0到多个选项，采用不同的选项，会影响业务处理的逻辑
 
在开发 brain 的时候，建议支持 help 和 echo 指令，比如：
```
jira:help
jira:help bind-project
jira:echo tell me what i have said
```
- `jira:help` 返回标识为 jira 的 brain 模块所支持的所有的指令
- `jira:help bind-project` 返回 bind-project 指令的详情，包括支持的选项说明
- `jira:echo tell me what i have said` 返回 echo 的内容，用于检验该 brain 模块当前是否在线并正常工作


## brain 模块

通过 wechaty-plugin-xyao 插件创建的 wechaty 机器人，它只负责微信消息的收发，若要使它具备一定的业务处理能力，就需要为其扩展 brain 模块。
机器人收到消息并识别为指令后，将指令通过 redis 交给相应的 brain 模块，brain 根据指令种类及选项参数进行相应的业务处理，并将处理结果通过redis
再交给机器人，由机器人发送微信消息给指定的用户。

所以我们可以简单的理解为：wechaty 机器人是耳朵和嘴巴，而 brain 模块则是大脑。你可以部署多种用于处理不同领域问题的大脑，比如股票行情，企业内部
的项目管理，当然也包括常见的群组管理，定时通知，翻译等领域。

brain 模块的开发并不限定语言或平台，任何能够连上 redis 并且可以处理 json 的语言都可以开发 brain。

### 基于 java springboot 快速开发 brain 模块快

为了简化 brain 模块的开发，可参考基于 java springboot 的 brain 开发框架（比如 [xyao-brain-trunk](https://github.com/watertao/xyao-brain-trunk) ），它会尽量将业务无关部分的逻辑统一处理掉，并默认提供了 help 或 echo 指令。

项目目录结构如下：
```bash
├── myapp
|   ├── src
|   |   └── main
|   |       ├── java
|   |       |   └── io
|   |       |       └── github
|   |       |           └── watertao
|   |       |               └──xyao
|   |       |                  └──infras
|   |       |                  └──instruction
|   |       └── resources
|   |           └── application.properties
│   └── pom.xml
```

其中 `io.github.watertao.xyao.infras` 这个 package 中包含了与 redis 通讯，指令的序列化和反序列化以及 echo 和 help 指令。同时也定义了
开发指令时需用到的一些 annotation 和 模型类。

`io.github.watertao.xyao.instruction` 这个 package 用于放置自定义指令处理类。

`application.properties` 是配置文件，它包含了以下配置：
```properties
# dev: 开发模式； prod: 生产模式。 这两种模式的主要区别是日志的输出不同，前者输出到控制台，后者输出到文件。一般我们在生产环境下，jar
# 包同级目录中放一个 config/application.properties 用于覆盖 jar 内的 properties。
spring.profiles.active = dev

# 本模块的 brain 标识
xyao.brain = fin

# bot 的 topic 名，本模块可以通过这个 topic 以 x.yao 的身份向指定用户或群组发送消息
xyao.channel = x.yao

# help -w 指令时向用户发送一个 UrlLink 形式的帮助文档
xyao.help.url = https://github.com/watertao/xyao-brain-fin-info/wiki/%5B-%23fin-%5D-Instruction-Manual-of-xyao-brain-fin-info
xyao.help.title = [ #fin ] Instruction Manual of xyao brain fin info
xyao.help.description = xyao-brain-fin-info is a brain module of wechaty-plugin-xyao, it provides common features, such as showing Shanghai or Shenzhen index, the real time price of specified stock , etc...
xyao.help.thumbnail = https://coding-net-production-file-ci.codehub.cn/1190d970-ce81-11ea-9a30-ed2db94588f5.jpeg?sign=yZ8k7anwCH4ma8CRXmTKSOc/2pRhPTEyNTcyNDI1OTkmaz1BS0lEYXk4M2xGbWFTNlk0TFRkek1WTzFTZFpPeUpTTk9ZcHImZT0xNTk1OTAyNDM3JnQ9MTU5NTY4NjQzNyZyPTMwMDE1OTAmZj0vMTE5MGQ5NzAtY2U4MS0xMWVhLTlhMzAtZWQyZGI5NDU4OGY1LmpwZWcmYj1jb2RpbmctbmV0LXByb2R1Y3Rpb24tZmlsZQ==

# redis 连接配置
spring.redis.host = localhost
spring.redis.port = 6379
spring.redis.password = 123456

# 日志输出级别
logging.root.level = INFO
# 系统日志输出 pattern，缺省为 %d{yyyy/MM/dd-HH:mm:ss SSS} %-5level - %msg %n
logging.encodePattern = %d{yyyy/MM/dd-HH:mm:ss SSS} %-5level - %msg %n
# logging.path = /myapp/log
# 日志文件的文件名，缺省为 spring.log
# logging.file = myapp.log
# 日志文件按时间切割的模式，缺省为 yyyy-MM-dd
# logging.splitPattern = yyyy-MM-dd
# 日志文件保留的个数，缺省为 30
# logging.maxHistory = 30
```

以开发一个返回随机数的指令为例。brain 标识为 `foo`, 指令名为 `random`，参数 `-m` 代表随机数小于该参数指定的数。

1. 修改 application.properties：
```properties
xyao.brain = foo
```
(其他诸如 reis 连接参数，日志 以及 帮助信息等配置自行按照实际情况修改)

2. 添加 `io.github.watertao.xyao.instruction.RandomHandler` 类：
```java
package io.github.watertao.xyao.instruction;

import io.github.watertao.xyao.infras.*;
import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.Options;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Random;

@Service("random")
@Instruction(
        syntax = "random <option>",
        description = "返回随机数，可通过参数设置最大范围",
        masterOnly = false,
        msgEnv = MessageEnvironmentEnum.BOTH
)
public class RandomHandler extends AbstractInstructionHandler {
    
    // 注入此 bean 用于发送消息至 redis
    @Autowired
    private XyaoChannelProxy channelProxy;
    
    @Override
    protected Options defineOptions() {
        Options options = new Options();
        options.addOption("m", "max", true,"随机数的最大范围");
        return options;
    }

    @Override
    protected void handle(XyaoInstruction instruction, CommandLine command) {
        Integer max = 10;   // 默认最大范围是 10
        
        // 如果用户指定了 m 选项，则最大范围设置成该选项值
        // （为了演示，忽略非数字字符的异常情况处理）
        if (command.hasOption("m")) {
            max = Integer.valueOf(command.getOptionValue("n"));
        }
        
        Integer randomNum = new Random().nextInt(max + 1);

        // 通过父类方法 makeResponseMessage 构建响应消息，该方法会将回复对象以及群组设置为指令发起人和指令发起时的群组
        XyaoMessage xyaoMessage = makeResponseMessage(instruction);
        xyaoMessage.getEntities().add(new XyaoMessage.StringEntity(String.valueOf(randomNum)));
        
        // 发送响应至 redis
        channelProxy.publish(xyaoMessage);
        
    }
}
``` 

搞定。

接着我们通过向机器人发送私聊或群内 @ 机器人，发送消息： `foo:random -m 100` ，机器人就会回复 0~100 以内的随机数。


## 已完成或计划中的 brain

|  brain  | status | description  |
|  ----  | ---- | ----  |
| [xyao-brain-trunk](https://github.com/watertao/xyao-brain-trunk) | 开发中 | 提供了微信机器人基本的处理能力，比如自定义 cron 形式的提醒，设置 todo-list, 消息搬运等特性 |
| [xyao-brain-jira](https://github.com/watertao/xyao-brain-jira) |  开发中 |提供 atlassion jira 相关的指令，比如将某个群组与某个 JIRA 项目绑定，定期推送每日 issue 进度及工时登录，检查 issue 规范性等 |
| [xyao-brain-fin-info](https://github.com/watertao/xyao-brain-fin-info) | 待开发 | 提供股市相关信息的查询或推送特性 |





