import ProList from "@/components/ProList";
import ProListItem from "@/components/ProListItem";
import { NodeIndexOutlined, ReloadOutlined } from "@ant-design/icons";
import { emit } from "@tauri-apps/api/event";
import { appLogDir, dataDir as tauriDataDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { Button, Space, Tooltip, message } from "antd";
import { isEqual, isString } from "lodash-es";
import type { FC } from "react";
import { fullName, transfer } from "tauri-plugin-fs-pro-api";
import type { State } from "../..";

const SavePath: FC<{ state: State }> = (props) => {
	const { state } = props;
	const { t } = useTranslation();
	const [dataDir, setDataDir] = useState("");
	const [logDir, setLogDir] = useState("");

	useMount(async () => {
		setDataDir(await tauriDataDir());
		setLogDir(await appLogDir());
	});

	const handleChange = async (isDefault = false) => {
		try {
			const dstDir = isDefault ? dataDir : await open({ directory: true });

			if (!isString(dstDir) || isEqualPath(dstDir)) return;

			const dstPath = joinPath(dstDir, getSaveDataDirName());

			state.spinning = true;

			emit(LISTEN_KEY.CLOSE_DATABASE);

			await wait();

			await transfer(getSaveDataPath(), dstPath, {
				includes: [
					await fullName(getSaveImagePath()),
					await fullName(await getSaveDatabasePath()),
				],
			});

			globalStore.env.saveDataDir = dstPath;

			emit(LISTEN_KEY.REFRESH_CLIPBOARD_LIST);

			message.success(
				t("preference.data_backup.storage_settings.hints.change_success"),
			);
		} catch (error: any) {
			message.error(error);
		} finally {
			state.spinning = false;
		}
	};

	const isEqualPath = (dstDir = dataDir) => {
		const dstPath = joinPath(dstDir, getSaveDataDirName());

		return isEqual(dstPath, getSaveDataPath());
	};

	const description = (path = getSaveDataPath()) => {
		return (
			<span
				className="hover:color-primary cursor-pointer break-all transition"
				onMouseDown={() => openPath(path)}
			>
				{joinPath(path)}
			</span>
		);
	};

	return (
		<ProList header={t("preference.data_backup.storage_settings.title")}>
			<ProListItem
				title={t(
					"preference.data_backup.storage_settings.label.data_storage_path",
				)}
				description={description()}
			>
				<Space.Compact>
					<Tooltip
						title={t(
							"preference.data_backup.storage_settings.hints.custom_path",
						)}
					>
						<Button
							icon={<NodeIndexOutlined />}
							onClick={() => handleChange()}
						/>
					</Tooltip>

					<Tooltip
						title={t(
							"preference.data_backup.storage_settings.hints.default_path",
						)}
					>
						<Button
							disabled={isEqualPath()}
							icon={<ReloadOutlined />}
							onClick={() => handleChange(true)}
						/>
					</Tooltip>
				</Space.Compact>
			</ProListItem>

			<ProListItem
				title={t(
					"preference.data_backup.storage_settings.label.log_storage_path",
				)}
				description={description(logDir)}
			/>
		</ProList>
	);
};

export default SavePath;
