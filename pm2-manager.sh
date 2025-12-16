#!/bin/bash

# PM2 美股每日总结服务器管理脚本

APP_NAME="stocksdaily"
CONFIG_FILE="ecosystem.config.js"

# 创建日志目录
mkdir -p logs

# 显示帮助信息
show_help() {
    echo "美股每日总结 PM2 管理脚本"
    echo ""
    echo "使用方法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  start     启动服务器"
    echo "  stop      停止服务器"
    echo "  restart   重启服务器"
    echo "  status    查看状态"
    echo "  logs      查看日志"
    echo "  monitor   监控面板"
    echo "  delete    删除应用"
    echo "  help      显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 start    # 启动服务器"
    echo "  $0 status   # 查看状态"
    echo "  $0 logs     # 查看日志"
}

# 启动服务器
start_server() {
    echo "正在启动美股每日总结服务器..."
    pm2 start $CONFIG_FILE
    echo "服务器已启动！"
    echo "访问地址: http://localhost:9821"
    echo "查看状态: pm2 status"
    echo "查看日志: pm2 logs $APP_NAME"
}

# 停止服务器
stop_server() {
    echo "正在停止美股每日总结服务器..."
    pm2 stop $APP_NAME
    echo "服务器已停止！"
}

# 重启服务器
restart_server() {
    echo "正在重启美股每日总结服务器..."
    pm2 restart $APP_NAME
    echo "服务器已重启！"
}

# 查看状态
show_status() {
    echo "=== 美股每日总结服务器状态 ==="
    pm2 status $APP_NAME
    echo ""
    echo "=== 端口监听状态 ==="
    if lsof -i :9821 > /dev/null 2>&1; then
        echo "✓ 9821端口正在监听"
    else
        echo "✗ 9821端口未监听"
    fi
    echo ""
    echo "=== 使用说明 ==="
    echo "启动: $0 start"
    echo "停止: $0 stop"
    echo "重启: $0 restart"
    echo "日志: $0 logs"
    echo "监控: $0 monitor"
}

# 查看日志
show_logs() {
    echo "正在显示日志 (按 Ctrl+C 退出)..."
    pm2 logs $APP_NAME
}

# 监控面板
show_monitor() {
    echo "正在启动PM2监控面板..."
    pm2 monit
}

# 删除应用
delete_app() {
    echo "正在删除美股每日总结应用..."
    pm2 delete $APP_NAME
    echo "应用已删除！"
}

# 主逻辑
case "$1" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    monitor)
        show_monitor
        ;;
    delete)
        delete_app
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "错误: 未知命令 '$1'"
        echo "使用 '$0 help' 查看可用命令"
        exit 1
        ;;
esac 