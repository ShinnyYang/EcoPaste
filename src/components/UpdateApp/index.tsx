import type { Interval } from "@/types/shared";
import { relaunch } from "@tauri-apps/plugin-process";
import { type Update, check } from "@tauri-apps/plugin-updater";
import { Flex, Modal, Typography, message } from "antd";
import clsx from "clsx";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import styles from "./index.module.scss";

const { Link, Text } = Typography;

interface State {
	open?: boolean;
	loading?: boolean;
	update?: Update;
	total?: number;
	download: number;
}

const UpdateApp = () => {
	const { t } = useTranslation();
	const timerRef = useRef<Interval>();
	const state = useReactive<State>({ download: 0 });
	const [messageApi, contextHolder] = message.useMessage();

	// 监听自动更新配置变化
	useImmediateKey(globalStore.update, "auto", (value) => {
		clearInterval(timerRef.current);

		if (!value) return;

		checkUpdate();

		timerRef.current = setInterval(checkUpdate, 1000 * 60 * 60 * 24);
	});

	// 监听参与测试版本配置变化
	useImmediateKey(globalStore.update, "beta", (value) => {
		if (!value) return;

		checkUpdate();
	});

	// 监听更新事件
	useTauriListen<boolean>(LISTEN_KEY.UPDATE_APP, () => {
		checkUpdate(true);

		messageApi.open({
			key: UPDATE_MESSAGE_KEY,
			type: "loading",
			content: t("component.app_update.hints.checking_update"),
			duration: 0,
		});
	});

	// 确认按钮的文字
	const okText = useCreation(() => {
		const { loading, total, download } = state;

		if (loading) {
			if (!total) return "0%";

			const percent = (download / total) * 100;

			return `${percent.toFixed(2)}%`;
		}

		return t("component.app_update.button.confirm_update");
	}, [state.loading, state.total, state.download]);

	// 检查更新
	const checkUpdate = async (showMessage = false) => {
		try {
			const update = await check({
				headers: {
					"join-beta": String(globalStore.update.beta),
				},
			});

			if (update?.available) {
				showWindow();

				const { version, currentVersion, body = "", date } = update;

				Object.assign(update, {
					version: `v${version}`,
					currentVersion: `v${currentVersion}`,
					body: replaceBody(body),
					date: formatDate(dayjs.utc(date?.split(".")[0]).local()),
				});

				Object.assign(state, { update, open: true });

				messageApi.destroy(UPDATE_MESSAGE_KEY);
			} else if (showMessage) {
				messageApi.open({
					key: UPDATE_MESSAGE_KEY,
					type: "success",
					content: t("component.app_update.hints.latest_version"),
				});
			}
		} catch (error) {
			if (!showMessage) return;

			messageApi.open({
				key: UPDATE_MESSAGE_KEY,
				type: "error",
				content: String(error),
			});
		}
	};

	// 替换更新日志里的内容
	const replaceBody = (body: string) => {
		return body
			.split("\n")
			.map((line) => line.replace(/\s*-\s+by\s+@.*/, ""))
			.join("\n");
	};

	const handleOk = async () => {
		state.loading = true;

		await state.update?.downloadAndInstall((progress) => {
			switch (progress.event) {
				case "Started":
					state.total = progress.data.contentLength;
					break;
				case "Progress":
					state.download += progress.data.chunkLength;
					break;
			}
		});

		state.loading = false;

		relaunch();
	};

	const handleCancel = () => {
		state.open = false;
	};

	return (
		<>
			{contextHolder}

			<Modal
				centered
				destroyOnClose
				open={state.open}
				closable={false}
				keyboard={false}
				maskClosable={false}
				title={t("component.app_update.label.new_version_title")}
				okText={okText}
				cancelText={t("component.app_update.button.cancel_update")}
				className={styles.modal}
				confirmLoading={state.loading}
				cancelButtonProps={{ disabled: state.loading }}
				onOk={handleOk}
				onCancel={handleCancel}
			>
				<Flex vertical gap="small" className="pt-1">
					<Flex align="center">
						{t("component.app_update.label.release_version")}：
						<span>
							{state.update?.currentVersion} 👉{" "}
							<Link
								href={`${GITHUB_LINK}/releases/tag/${state.update?.version}`}
							>
								{state.update?.version}
							</Link>
						</span>
					</Flex>

					<Flex align="center">
						{t("component.app_update.label.release_time")}：
						<span>{state.update?.date}</span>
					</Flex>

					<Flex vertical>
						{t("component.app_update.label.release_notes")}：
						<Markdown
							className={clsx(styles.markdown, "max-h-50 overflow-auto")}
							rehypePlugins={[rehypeRaw]}
							components={{
								a: ({ href, children }) => <Link href={href}>{children}</Link>,
								mark: ({ children }) => <Text mark>{children}</Text>,
								code: ({ children }) => <Text code>{children}</Text>,
							}}
						>
							{state.update?.body}
						</Markdown>
					</Flex>
				</Flex>
			</Modal>
		</>
	);
};

export default UpdateApp;
